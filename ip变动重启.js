/**
 * @author muzi
 * @name ip变动重启bncr以及docker
 * @origin muzi
 * @version 1.1.0
 * @description ip变动重启for双拨，多拨，需要在bncr容器中安装docker，apk add --no-cache docker-cli并重启容器，我是为了重启外部qq,go-cqhttp容器，所以重启go-cqhttp容器，如果你的qq容器名不是go-cqhttp，那么请自行修改
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
const maxIPCount = 2; // 设置 IP 数量（双拨、多拨等）
//获取ip
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
//重启docker
function restartContainer(containerNameOrId) {
  exec(`docker restart ${containerNameOrId}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error restarting container: ${error}`);
    } else {
      console.log(`Container restarted: ${stdout}`);
    }
  });
}
//主程序
module.exports = async s => {
  // 获取数据库中的数据
  const v4DB = (await sysDB.get('publicIpv4')) || [];//获取数据库中的ip
  const deletedIps = (await sysDB.get('deletedIps')) || [];
  const lastCheckedIp = (await sysDB.get('lastCheckedIp')) || '';
  const nowV4ip = await getPublicIp();//获取当前ip

  let logs = `上次ip:${(lastCheckedIp && AmTool.Masking(lastCheckedIp, 5, 6)) || '空'}\n`;
  logs += `本次ip:${(nowV4ip && AmTool.Masking(nowV4ip, 5, 6)) || '空'}\n`;
  let open = false;

  if (nowV4ip === null) {
    // 获取 IP 失败，不执行后续操作
    return;
  }

  if (v4DB.length < maxIPCount) {
    // 如果 v4DB中ip数小于多拨数
    v4DB.push(nowV4ip);
    await sysDB.set('publicIpv4', v4DB);
  } else {
    // 如果 v4DB 不为空，判断当前 IP 是否与 v4DB 中的 IP 相同
    if (!v4DB.includes(nowV4ip)) {
      // 如果不同，判断当前 IP 是否在 deletedIps 中
      if (deletedIps.includes(nowV4ip)) {
      // 如果在，即代表v4DB中ip误删除
      } else {
        logs += '进行bncr与docker重启...';
        open = true;
        // 如果不在 deletedIps 中，判断 v4DB 的长度是否大于等于 maxIPCount
        if (v4DB.length >= maxIPCount) {
          const removedIp = v4DB.shift();
          deletedIps.shift();
          deletedIps.push(removedIp);
          await sysDB.set('deletedIps', deletedIps);
        }
        restartContainer('go-cqhttp');
        v4DB.push(nowV4ip);
        //将当前IP添加到v4DB
        await sysDB.set('publicIpv4', v4DB); //保存到数据库
      }
      
    }
  }
  await sysDB.set('lastCheckedIp', nowV4ip); //保存到数据库
  
//输出日志用以纠错
  console.log('v4DB', v4DB);
  console.log('deletedIps', deletedIps);
  console.log('lastCheckedIp', lastCheckedIp);

//回复
  await s.reply(logs);
  open && (s.getFrom() === 'cron' ? sysMethod.inline('重启') : s.inlineSugar('重启'));
};
