// 没有 Apple 开发者证书时用临时签名（ad-hoc）：应用包从“完全未签名”变成结构完整，
// Gatekeeper 会给“仍要打开”的入口；配合首次打开时去掉 quarantine 标记即可正常运行。
const { spawnSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  const result = spawnSync('/usr/bin/codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', app], { stdio: 'inherit' });
  if (result.status !== 0) throw Error('ad-hoc codesign failed');
  console.log(`Ad-hoc signed: ${app}`);
};
