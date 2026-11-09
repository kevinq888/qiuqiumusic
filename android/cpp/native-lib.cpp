#include <jni.h>
#include <node.h>
#include <unistd.h>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <unwind.h>
#include <dlfcn.h>
#include <csignal>
#include <cstdint>
#include <fcntl.h>
#include <pthread.h>
#include <sys/prctl.h>
#include <android/log.h>

#define LOG_TAG "WeiMoNode"
#define LOG_INFO(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOG_ERROR(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static int outPipe[2];
static int errPipe[2];
static char logPath[512];

static void appendLog(const char* text) {
  if (!logPath[0]) return;
  FILE* file = fopen(logPath, "a");
  if (!file) return;
  fputs(text, file);
  fputc('\n', file);
  fclose(file);
}

static int capturedLines = 0;

static bool isNoise(const char* text) {
  return strstr(text, "s_glBind") != nullptr || strstr(text, "libEGL") != nullptr ||
         strstr(text, "OpenGL") != nullptr || strstr(text, "hwui") != nullptr;
}

static void captureLine(const char* prefix, const char* text) {
  if (capturedLines >= 400 || isNoise(text)) return;
  ++capturedLines;
  char line[2200];
  snprintf(line, sizeof line, "%s%s", prefix, text);
  appendLog(line);
}

static void* pumpLog(void* arg) {
  int fd = *static_cast<int*>(arg);
  bool isErr = (fd == errPipe[0]);
  char buffer[2048];
  ssize_t size;
  while ((size = read(fd, buffer, sizeof buffer - 1)) > 0) {
    if (buffer[size - 1] == '\n') --size;
    buffer[size] = 0;
    __android_log_write(isErr ? ANDROID_LOG_ERROR : ANDROID_LOG_INFO, LOG_TAG, buffer);
    captureLine(isErr ? "err: " : "out: ", buffer);
  }
  return nullptr;
}

// Node 的 console.log 默认写到 stdout，安卓上需要转到 logcat 才能看到。
static void redirectStdio() {
  setvbuf(stdout, nullptr, _IONBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);
  pipe(outPipe);
  pipe(errPipe);
  dup2(outPipe[1], STDOUT_FILENO);
  dup2(errPipe[1], STDERR_FILENO);
  pthread_t thread;
  pthread_create(&thread, nullptr, pumpLog, &outPipe[0]);
  pthread_create(&thread, nullptr, pumpLog, &errPipe[0]);
}

// 原生崩溃无法被 Java 捕获，这里把信号、故障地址与调用栈写进文件，供下次启动展示。
struct TraceState {
  void* frames[32];
  int count;
};

static _Unwind_Reason_Code collectFrame(struct _Unwind_Context* context, void* arg) {
  TraceState* state = static_cast<TraceState*>(arg);
  void* ip = reinterpret_cast<void*>(_Unwind_GetIP(context));
  if (ip != nullptr && state->count < 32) state->frames[state->count++] = ip;
  return _URC_NO_REASON;
}

static void onFatalSignal(int sig, siginfo_t* info, void*) {
  int fd = -1;
  if (logPath[0]) fd = open(logPath, O_WRONLY | O_APPEND | O_CREAT, 0600);
  char buffer[512];
  long long address = info ? (long long)(uintptr_t)info->si_addr : 0;
  const char* name = "?";
  char threadName[32];
  threadName[0] = 0;
  if (prctl(PR_GET_NAME, threadName, 0, 0, 0) == 0 && threadName[0]) {
    name = threadName;
  }
  int size = snprintf(buffer, sizeof buffer,
                      "\nFATAL_SIGNAL sig=%d code=%d addr=0x%llx thread=%s\n",
                      sig, info ? info->si_code : -1, address, name);
  if (fd >= 0) write(fd, buffer, size);

  TraceState state;
  state.count = 0;
  _Unwind_Backtrace(collectFrame, &state);
  for (int index = 0; index < state.count; ++index) {
    Dl_info info;
    if (dladdr(state.frames[index], &info) == 0) continue;
    const char* library = info.dli_fname ? info.dli_fname : "?";
    const char* slash = strrchr(library, '/');
    if (slash) library = slash + 1;
    long offset = (long)((char*)state.frames[index] - (char*)info.dli_fbase);
    const char* symbol = info.dli_sname ? info.dli_sname : "?";
    size = snprintf(buffer, sizeof buffer, "  #%d %s+0x%lx %s\n", index, library, offset, symbol);
    if (fd >= 0) write(fd, buffer, size);
  }
  if (fd >= 0) close(fd);
  _exit(128 + sig);
}

static void installCrashHandler() {
  struct sigaction action;
  memset(&action, 0, sizeof action);
  action.sa_sigaction = onFatalSignal;
  action.sa_flags = SA_SIGINFO | SA_ONSTACK;
  sigaction(SIGSEGV, &action, nullptr);
  sigaction(SIGABRT, &action, nullptr);
  sigaction(SIGILL, &action, nullptr);
  sigaction(SIGBUS, &action, nullptr);
  sigaction(SIGFPE, &action, nullptr);
}

extern "C" JNIEXPORT void JNICALL
Java_com_weimo_music_NodeRunner_startNode(JNIEnv* env, jclass, jstring script, jstring cwd,
                                           jstring port, jstring dataDir, jstring logFile,
                                           jint variant) {
  const char* scriptPath = env->GetStringUTFChars(script, nullptr);
  const char* workDir = env->GetStringUTFChars(cwd, nullptr);
  const char* portValue = env->GetStringUTFChars(port, nullptr);
  const char* dataPath = env->GetStringUTFChars(dataDir, nullptr);
  const char* logValue = env->GetStringUTFChars(logFile, nullptr);

  snprintf(logPath, sizeof logPath, "%s", logValue);
  appendLog("native: log ready");
  installCrashHandler();
  appendLog("native: crash handler installed");

  setenv("QIUQIU_DATA_DIR", dataPath, 1);
  setenv("PORT", portValue, 1);
  // 服务端可能换端口（部分 ROM 拒绝绑定固定端口），实际端口写在这里供界面进程读取。
  char portFile[512];
  snprintf(portFile, sizeof portFile, "%s/port", dataPath);
  setenv("QIUQIU_PORT_FILE", portFile, 1);
  setenv("NODE_ENV", "production", 1);
  redirectStdio();
  appendLog("native: stdio redirected");

  if (chdir(workDir) != 0) appendLog("native: chdir failed");
  else appendLog("native: chdir ok");
  LOG_INFO("启动内置 Node: %s variant=%d", scriptPath, (int)variant);
  char buffer[96];
  snprintf(buffer, sizeof buffer, "native: entering node::Start variant=%d", (int)variant);
  appendLog(buffer);

  char arg0[] = "node";
  char argJitless[] = "--jitless";
  char argHeap[] = "--max-old-space-size=256";
  char* argv[5];
  int argc = 2;
  argv[0] = arg0;
  argv[1] = const_cast<char*>(scriptPath);
  if (variant >= 1) {
    argv[argc - 1] = argJitless;
    argv[argc++] = const_cast<char*>(scriptPath);
  }
  if (variant >= 2) {
    argv[argc - 1] = argHeap;
    argv[argc++] = const_cast<char*>(scriptPath);
  }
  argv[argc] = nullptr;
  int code = node::Start(argc, argv);
  snprintf(buffer, sizeof buffer, "native: node exited code=%d", code);
  appendLog(buffer);
  LOG_ERROR("Node 退出，code=%d", code);

  env->ReleaseStringUTFChars(script, scriptPath);
  env->ReleaseStringUTFChars(cwd, workDir);
  env->ReleaseStringUTFChars(port, portValue);
  env->ReleaseStringUTFChars(dataDir, dataPath);
  env->ReleaseStringUTFChars(logFile, logValue);
}
