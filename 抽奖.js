/**
 * @author muzi
 * @name Lottery Script
 * @description Lottery from a group
 * @rule ^(抽奖)(开|关)$
 * @rule ^(1)$
 * @admin true
 * @public true
 * @origin origin什么意思
 * @version 1.0.0
 * @priority 200
 * @disable false
 */


// 创建数据库实例
const lotteryDb = new BncrDB('lottery');

module.exports = async (s) => {
    // 当管理员设置开启抽奖
    if (await s.param(2) === '开') {
        // 将抽奖状态设为开启
        if (await lotteryDb.set('LotteryStatus', 'on')) {
            await s.reply('设置成功，抽奖已开启');
        }
        else { 
            await s.delMsg(s.reply('设置失败'), 5);
        }
    }
    // 当管理员设置关闭抽奖
    else if (await s.param(2) === '关') {
        // 将抽奖状态设为关闭
        if (await lotteryDb.set('LotteryStatus', 'off')) {
            await s.reply('设置成功，抽奖已关闭');
    
            // 开奖
            let participants = await lotteryDb.get('LotteryParticipants') || [];
            if (participants.length > 0) {
                const winner = participants[Math.floor(Math.random() * participants.length)];
                // 直接从记录中获取 UserName
                const winnerName = winner.name;
    
                // 回执 $sender + '中奖啦！'
                s.reply(winnerName + '中奖啦！');
    
                // 清空数据库
                await lotteryDb.set('LotteryParticipants', []);
            }
        }
        else { 
            await s.delMsg(s.reply('设置失败'), 5);
        }
    }
    // 当用户参与抽奖
    else if (await s.param(1) == '1') {
        const currentStatus = await lotteryDb.get('LotteryStatus');
        if (currentStatus !== 'on') {
            await s.reply('当前抽奖未开启');
            return;
        }
    
        // 记录抽奖参与者 UserId 和 UserName
        const UserId = await s.getUserId();
        const UserName = await s.getUserName();
    
        // 从数据库中获取所有的参与者
        let participants = await lotteryDb.get('LotteryParticipants') || [];
    
        // 判断用户是否已经参与过抽奖
        if (participants.find(participant => participant.id === UserId)) {
            // 如果找到了相同的 UserId，那么这个用户已经参与过抽奖，所以不再添加
            await s.reply('您已经参与过抽奖，不能重复参与');
            return;
        }
    
        // 将新的参与者加入到参与者列表中，同时记录他们的 UserName
        participants.push({ id: UserId, name: UserName });
    
        // 将更新后的参与者列表存储到数据库中
        await lotteryDb.set('LotteryParticipants', participants);
    
        // 回执 $sender + '参与抽奖成功'
        await s.reply(UserName + '，您已成功参与');
    }
    
    

}    