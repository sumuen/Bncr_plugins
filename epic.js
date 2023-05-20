/**
 * @author muzi
 * @name EpicStore免费游戏查询
 * @origin Adapted from a Python script
 * @version 1.0.0
 * @description Epic Games Store免费游戏查询
 * @rule ^epic$
 * @admin false
 * @public false
 * @priority 100
 * @disable false
 * @cron 0 0 12 * * 5
 */
//从https://rsshub.app/epicgames/freegames/zh-CN提取item并发送到指定群组

//推送对象
const senders = [
    {
        id: 364542087, // 要通知的QQ群ID
        from: 'qq',
        type: 'groupId',
    },
];
const cheerio = require('cheerio');
const axios = require('axios');
const xml2js = require('xml2js');
const htmlToText = require('html-to-text');
const request = require('request');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// 解析RSS Feed的时间戳
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}年${date.getMonth() + 1
        }月${date.getDate()}日${date.getHours()}时`;
}

async function writeToJpg(url) {
    let open = false;
    const paths = path.join(process.cwd(), `BncrData/public/${randomUUID().split('-').join('') + '.png'}`);
    const jpgHttpURL = paths.replace("/bncr/BncrData/public/", "http://192.168.3.6:9090/public/");
    return new Promise((resolve, reject) => {
        let stream = request(url).pipe(fs.createWriteStream(paths));
        stream.on('finish', () => {
            resolve({ url: jpgHttpURL, path: paths });
        });
    });
};

module.exports = async s => {
    const response = await axios.get('https://rsshub.app/epicgames/freegames/zh-CN');
    const parsedResult = await xml2js.parseStringPromise(response.data);

    parsedResult.rss.channel[0].item.forEach(async (item) => {
        let name = item.title[0];
        let url = item.link[0];
        let description = item.description[0];
        let time = formatTime(item.pubDate[0]);
        let $ = cheerio.load(description);
        let imageUrl = $('img').attr('src');
        let image = await writeToJpg(imageUrl);

        let msgStr = `🎮 [Epic 限免]  ${name}\n⏰ 发布时间: ${time}\n💡 游戏简介:\n${$.text()}\n🔗 游戏链接: ${url}`;

        if (s.getFrom() === 'cron') {
            senders.forEach(e => {
                let obj = {
                    platform: e.from,
                    msg: msgStr,
                    type: 'image',
                    path: image.url,
                };
                obj[e.type] = e.id;
                sysMethod.push(obj);
                open=true;

            });
            await Promise.all(promises); // 等待所有操作完成
        } else {
            await s.reply(msgStr);
            await s.reply({
                type: 'image',
                path: image.url,
            });
            
            open=true;
        }
    // 删除图片
    if (open) {
        try {
             fs.unlinkSync(image.path); // 使用 image.path 替换了 imagePath
            console.log('Successfully deleted the image');
        } catch (err) {
            console.error('There was an error:', err);
        }
    }
                
    });
    
};
               

    
//       senders.forEach(sender => {
//         let obj = {
//           platform: sender.from,
//           msg: msgStr,
//         };
//         obj[sender.type] = sender.id;
//         s.reply(msgStr);
//         s.reply(obj); // 使用你的发送消息函数 // 您需要将此替换为实际的发送消息的函数
//       });
//     });
//   };