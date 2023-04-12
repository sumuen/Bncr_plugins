/**
 * @author Aming
 * @name ip变动重启
 * @origin muzi
 * @version 1.0.0
 * @description ip变动重启for双拨
 * @rule ^ip检测$
 * @priority 1000
 * @admin true
 * @public false
 * @disable false
 * @cron 0 *\/1 * * * *
 */
const axios = require('axios');
const AmTool = require('./mod/AmTool');
const sysDB = new BncrDB('system');

async function getPublicIp() {
  try {
    const response = await axios.get('https://ip.useragentinfo.com/json');
    const data = response.data;
    return data.ip;
  } catch (error) {
    console.error('获取公共IP地址时发生错误:', error);
  }
}

module.exports = async s => {
  const v4DB = (await sysDB.get('publicIpv4')) || [];
  const nowV4ip = await getPublicIp();

  let logs = `上次ip:${(v4DB && AmTool.Masking(v4DB, 5, 6)) || '空'}\n`;
  logs += `本次ip:${(nowV4ip && AmTool.Masking(nowV4ip, 5, 6)) || '空'}\n`;
  let open = false;

  if (!v4DB.includes(nowV4ip)) {
    if (v4DB.length >= 2) {
      logs += '重启中...';
      open = true;
      // 删除旧的 IP 地址
      v4DB.shift();
    }
    // 保存新的 IP 地址
    v4DB.push(nowV4ip);
    await sysDB.set('publicIpv4', v4DB);
  }

  await s.reply(logs);
  open && (s.getFrom() === 'cron' ? sysMethod.inline('重启') : s.inlineSugar('重启'));
};
