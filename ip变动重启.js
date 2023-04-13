/**
 * @author Aming
 * @name ip变动重启bncr以及docker
 * @origin muzi
 * @version 1.0.5
 * @description ip变动重启for双拨
 * @rule ^ip$
 * @priority 1000
 * @admin true
 * @public false
 * @disable false
 * @cron 0 *\/1 * * * *
 */
const axios = require('axios');
const AmTool = require('./mod/AmTool');
const sysDB = new BncrDB('system');
const { exec } = require('child_process');
async function getPublicIp() {
  try {
    const response = await axios.get('https://ip.useragentinfo.com/json', { timeout: 10000 }); // 设置 10 秒超时
    const data = response.data;
    return data.ip;
  } catch (error) {
    console.error('获取公共IP地址时发生错误:', error);
    return null;
  }
}
function restartContainer(containerNameOrId) {
  exec(`docker restart ${containerNameOrId}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error restarting container: ${error}`);
    } else {
      console.log(`Container restarted: ${stdout}`);
    }
  });
}
module.exports = async s => {
  const v4DB = (await sysDB.get('publicIpv4')) || [];
  const deletedIps = (await sysDB.get('deletedIps')) || [];
  const lastCheckedIp = (await sysDB.get('lastCheckedIp')) || '';
  const nowV4ip = await getPublicIp();

  if (nowV4ip === null) {
    // 获取 IP 失败，不执行后续操作
    return;
  }

  let logs = `上次ip:${(lastCheckedIp && AmTool.Masking(lastCheckedIp, 5, 6)) || '空'}\n`;
  logs += `本次ip:${(nowV4ip && AmTool.Masking(nowV4ip, 5, 6)) || '空'}\n`;
  let open = false;

  if (lastCheckedIp !== nowV4ip) {
    if (deletedIps.includes(nowV4ip)) {
      v4DB.push(nowV4ip);
      deletedIps.splice(deletedIps.indexOf(nowV4ip), 1);
      await sysDB.set('deletedIps', deletedIps);
    } else if (!v4DB.includes(nowV4ip)) {
      if (v4DB.length >= 2) {
        logs += '进行bncr与docker重启...';
        open = true;
        const removedIp = v4DB.shift();
        deletedIps.push(removedIp);
        await sysDB.set('deletedIps', deletedIps);
        restartContainer('go-cqhttp');
      }
      v4DB.push(nowV4ip);
    }
    await sysDB.set('publicIpv4', v4DB);
    await sysDB.set('lastCheckedIp', nowV4ip);
  }

  await s.reply(logs);
  open && (s.getFrom() === 'cron' ? sysMethod.inline('重启') : s.inlineSugar('重启'));
};
