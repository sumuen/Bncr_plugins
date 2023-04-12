/**
 * @author Aming
 * @name Bncr_ChatGPT
 * @origin Bncr团队
 * @version 1.0.0
 * @description ChatGpt聊天 accessToken 版本
 * @rule ^ai ([\s\S]+)$
 * @admin false
 * @public false
 * @priority 9999
 * @disable false
 */

let api = {};

module.exports = async s => {
    /* 补全依赖 */
    await sysMethod.testModule(['chatgpt'], { install: true });
    const chatGPTStorage = new BncrDB('ChatGPT');
    const apiKey = await chatGPTStorage.get('APIKey');
    if (!apiKey) return s.reply("请使用命令'set ChatGPT APIKey ?,设置ChatGPT的API密钥");

    if (!api?.sendMessage) {
        const { ChatGPTAPI } = await import('chatgpt');
        api = new ChatGPTAPI({
            apiKey,
        });
        console.log('初始化ChatGPT...');
    }

    let platform = s.getFrom(),
        userId = s.getUserId();

    if (s.param(1) === '清空上下文') {
        await chatGPTStorage.del(`${platform}:${userId}`);
        return s.reply('清空上下文成功...');
    }

    let opt = {
        timeoutMs: 2 * 60 * 1000,
    };

    /* 获取上下文 */
    const getUesrInfo = await chatGPTStorage.get(`${platform}:${userId}`);
    if (getUesrInfo) {
        opt['parentMessageId'] = getUesrInfo.parentMessageId;
        console.log('读取会话...');
    } else {
        console.log('创建新的会话...');
    }

    let res = {},
        maxNum = 5,
        logs = ``;
    s.reply(`Let me see...`);
    do {
        try {
            res = await api.sendMessage(s.param(1), opt);
            if (!res?.text) {
                logs += `未获取到消息,去重试...\n`;
                continue;
            }
            logs += `回复:\n${res.text}\n`;
            break;
        } catch (e) {
            opt = {
                timeoutMs: 2 * 60 * 1000,
            };
            logs += '会话出现错误,尝试重新创建会话...\n';
            if (maxNum === 1) logs += '如果持续出现错误,请考虑API密钥是否正确,或者在控制台查看错误!\n';
            console.log('ChatGPT.js:', e);
            await sysMethod.sleep(1);
        }
    } while (maxNum-- > 1);
    if (!logs) return;
    await s.reply(`触发消息:\n${s.getMsg()}\n\n${logs}`);
    // console.log('res', res);
    if (!res?.id) return;
    /* 存储上下文 */
    await chatGPTStorage.set(`${platform}:${userId}`, {
        parentMessageId: res.id,
    });
};
