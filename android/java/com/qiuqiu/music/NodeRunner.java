package com.qiuqiu.music;

/** 通过 JNI 在当前进程里启动 libnode（Node.js 运行时）。 */
public final class NodeRunner {
    static {
        // libnode.so 依赖 libc++_shared.so，显式先加载可避免个别 ROM 的命名空间问题。
        System.loadLibrary("c++_shared");
        System.loadLibrary("node");
        System.loadLibrary("qiunode");
    }

    private NodeRunner() {}

    /**
     * 阻塞运行，必须在独立线程调用。
     *
     * @param script  入口脚本绝对路径
     * @param cwd     工作目录
     * @param port    本地服务端口
     * @param dataDir 可写数据目录
     * @param logFile 诊断日志文件
     * @param variant 启动方案：0 正常，1 关闭 JIT，2 关闭 JIT 且限制堆大小
     */
    public static native void startNode(String script, String cwd, String port, String dataDir,
                                        String logFile, int variant);
}
