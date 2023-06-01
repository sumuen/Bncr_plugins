/**
 * @author muzi
 * @name BigFoot Script
 * @description Big foot game for a group
 * @rule ^(今天看了h图)$
 * @rule ^(今天看了h片)$
 * @rule ^(今天打了脚)$
 * @rule ^(帮打)$
 * @rule ^(大脚排名)$
 * @rule ^(大脚指南)$
 * @rule ^(胶)([0-9]+) ([\s\S]+)$
 * @rule ^(大脚市场)$
 * @rule ^(脚易)$
 * @rule ^(打卡)$
 * @rule ^(打卡排名)$
 * @rule ^(禅) ([\s\S]+)$
 * @admin false
 * @public true
 * @origin origin什么意思
 * @version 1.1.0
 * @priority 200
 * @disable false
 */

const axios = require('axios');
const { be } = require("date-fns/locale");
const e = require("express");

// 创建数据库实例
const footDb = new BncrDB('Foot');
const footMarketDb = new BncrDB('FootMarket');
const footcheckDb = new BncrDB('FootCheck');
const today = new Date().toDateString();
module.exports = async (s) => {
    let footUsers = await footDb.get('FootUsers') || [];

    const userId = await s.getUserId();
    const userName = await s.getUserName();

    let user = footUsers.find(u => u.id === userId);
    if (!user) {
        user = { id: userId, name: userName, footValue: 0, footCount: 0, lastRun: null };
        footUsers.push(user);
        await footDb.set('FootUsers', footUsers); // 仅在新用户加入时更新数据库
    }


    let param1 = await s.param(1);
    for (let user of footUsers) {
        if (!user.hasOwnProperty('hplastRun')) {
            user.hplastRun = null;
        }
        if (!user.hasOwnProperty('htlastRun')) {
            user.htlastRun = null;
        }
        if (!user.hasOwnProperty('djlastRun')) {
            user.djlastRun = null;
        }
    }
    await footDb.set('FootUsers', footUsers);

    //获取排名
    async function generateRanking(footUsers) {
        footUsers.sort((a, b) => b.footValue - a.footValue);
        const titles = ['大脚英雄', '大脚先锋', '大脚卫士', '大脚先生'];

        footUsers.forEach((u, i) => {
            if (i < titles.length) {
                u.title = titles[i];
            } else {
                u.title = '大脚勇士 #' + (i + 1);
            }
        });

        let response = '大脚排名：\n';
        footUsers.forEach((u, i) => {
            response += (i + 1) + '. ' + u.name + ': ' + u.footValue + ' (' + u.title + ')\n';
        });
        return response;
    }
    //帮打
    async function helpFoot(s, user, footUsers) {
        const ranking = await generateRanking(footUsers);
        await s.reply(`今天要帮哪位群友打脚呢？\n${ranking}`);
        const inputA = await s.waitInput(() => { }, 60);
        const a = inputA.getMsg();
        console.log(inputA);
        // 判断inputA是数字还是用户名
        let targetUser;
        if (isFinite(a) && Math.floor(a) == a) {
            // inputA是一个数字，代表排名
            const rank = parseInt(a) - 1; // -1因为数组的索引是从0开始的
            if (rank < 0 || rank >= footUsers.length) {
                await s.reply(`没有找到排名为${a}的用户，请检查排名是否正确。`);
                return;
            }
            targetUser = footUsers[rank];
        } else {
            // inputA是用户名
            targetUser = footUsers.find(u => u.name === a);
        }

        if (!targetUser) {
            // 用户未找到
            await s.reply(`没有找到名字为${a}的用户，请检查名字是否正确。`);
            return;
        }
        //初始化用户的大脚币
        if (!user.coins) {
            user.coins = {};
        }
        // 用户被找到，进行下一步的操作...
        await s.reply(`你选中的是${targetUser.name}, 他的大脚值为${targetUser.footValue}，你要帮他打多少脚呢？还是，你要梭哈吗？`);
        const inputB = await s.waitInput(() => { }, 60);
        let b = inputB.getMsg();
        let betValue;
        if (b === '梭哈') {
            // 梭哈
            betValue = user.footValue;
        } else {
            // 不是梭哈，判断是否是数字

            if (!isFinite(b) || Math.floor(b) != b) {
                await s.reply('请输入一个整数');
                return; // 结束 
            } else {
                betValue = parseInt(b);
            }
        }

        if (user.footValue < betValue) {
            await s.reply('你的大脚值不足');
            return;
        }

        // 计算获胜的概率
        let otherUserFootValue = targetUser.footValue;

        let winProbability = betValue / (betValue + otherUserFootValue);
        await s.reply('你的获胜概率是：' + winProbability * 100 + '%');

        // 随机一个0到1的数，看看是否小于winProbability，如果是，表示user赢了
        if (Math.random() < winProbability) {
            if (targetUser.footValue >= betValue) {
                // user赢了，将otherUser的大脚值转移给user
                targetUser.footValue -= betValue;
                user.footValue += betValue;
                await s.reply('你获胜了，你赢得了' + betValue + '大脚值');
            }
            else {
                let otherUserOldFootValue = targetUser.footValue;
                user.footValue += otherUserOldFootValue;
                targetUser.footValue = 0;
                await s.reply('你获胜了，你赢得了' + otherUserOldFootValue + '大脚值');
            }
        } else {
            // user输了，将betValue转移给targetUser
            user.footValue -= betValue;
            targetUser.footValue += betValue;
            await s.reply('你输了，你失去了' + betValue + '大脚值');
        }

        // 在结束之后，记得更新数据库
        await footDb.set('FootUsers', footUsers);
    }
    //查询加密货币
    async function getCryptoPrice(cryptoNames) {
        const prices = {};

        for (let i = 0; i < cryptoNames.length; i++) {
            const endpoint = `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${cryptoNames[i].toUpperCase()}_USDT`;

            try {
                const response = await axios.get(endpoint);
                const data = response.data;

                if (data && data.length > 0) {
                    const price = parseFloat(data[0].last);
                    const changePercentage = data[0].change_percentage;
                    prices[cryptoNames[i]] = {
                        price: price,
                        changePercentage: changePercentage
                    };
                } else {
                    prices[cryptoNames[i]] = null;
                }
            } catch (error) {
                console.error(error);
                prices[cryptoNames[i]] = null;
            }
        }

        return prices;
    }

    // // 用户购买加密货币
    // async function buyCoin(s) {
    //     const userName = await s.getUserName();
    //     const user = footValueUsers.find(u => u.name === userName);

    //     const coin = s.param(1); //用户选择购买的货币类型
    //     const amount = Number(s.param(2)); //用户选择购买的数量
    //     const leverage = Number(s.param(3)) || 1; //用户选择的杠杆倍数，如果没有选择，则默认为1

    //     const price = await getCryptoPrice(coin);

    //     if (price === null) {
    //         await s.reply('无法获取加密货币价格');
    //         return;
    //     }

    //     if (user.footValue >= price * amount * leverage) {
    //         user.footValue -= price * amount * leverage;
    //         user.coins[coin] = (user.coins[coin] || 0) + amount * leverage;
    //         await s.reply(`你用${leverage}倍杠杆购买了${amount * leverage}个${coin}，花费了${price * amount * leverage}大脚值`);
    //     } else {
    //         await s.reply('你的大脚值不足');
    //     }
    // }
    // 用户购买加密货币
    async function buyCoin(s, user, coin, amount, leverage) {
        const price = await getCryptoPrice(coin);

        if (price === null) {
            await s.reply('无法获取加密货币价格');
            return;
        }

        if (user.footValue >= price * amount * leverage) {
            user.footValue -= price * amount * leverage;
            user.coins[coin] = (user.coins[coin] || 0) + amount * leverage;
            await s.reply(`你用${leverage}倍杠杆购买了${amount * leverage}个${coin}，花费了${price * amount * leverage}大脚值`);

            // 将交易记录在footMarketDb
            let transaction = {
                userID: user.userID,
                action: "购买",
                coin: coin,
                amount: amount * leverage,
                price: price,
                leverage: leverage
            };
            await footMarketDb.set('Transactions', transaction);
        } else {
            await s.reply('你的大脚值不足');
        }
    }

    // 用户出售加密货币
    async function sellCoin(s, user, coin, amount) {
        const price = await getCryptoPrice(coin);

        if (price === null) {
            await s.reply('无法获取加密货币价格');
            return;
        }

        if (user.coins[coin] >= amount) {
            user.footValue += price * amount;
            user.coins[coin] -= amount;
            await s.reply(`你卖出了${amount}个${coin}，得到了${price * amount}大脚值`);

            // 将交易记录在footMarketDb
            let transaction = {
                userID: user.userID,
                action: "卖出",
                coin: coin,
                amount: amount,
                price: price,
            };
            await footMarketDb.set('Transactions', transaction);
        } else {
            await s.reply('你的加密货币数量不足');
        }
    }
    // 查看钱包命令
    async function showWallet(s, user) {
        let transactions = await footMarketDb.get('Transactions');
        let userTransactions = transactions.filter(transaction => transaction.userID === user.userID);

        // 列出所有交易记录
        for (let transaction of userTransactions) {
            await s.reply(`操作：${transaction.action}，币种：${transaction.coin}，数量：${transaction.amount}，价格：${transaction.price}${transaction.leverage ? '，杠杆：' + transaction.leverage : ''}`);
        }
    }
    var himage = true;
    if (param1 === '今天看了h图') {
        //添加时间限制，每天运行前三次执行user.footValue += 1;，超过不执行
        if (!user.hasOwnProperty('htcount') || !user.hasOwnProperty('htlastRunDay') || user.htlastRunDay !== today) {
            // 如果htcount不存在，或者hlastRunDay不存在，或者最后一次的活动不是今天，那么重置htcount
            user.htcount = 1;
            user.htlastRunDay = today;
            user.footValue += 1;
            //获取当前时间
            let now = new Date();
            //获取当前小时分钟
            let hour = now.getHours();
            let minute = now.getMinutes();
            s.reply(hour + '点' + minute + '分' + userName + '就起来看h图了，真是个色狼');
        } else if (user.htcount < 3) {
            // 如果htcount小于3，那么增加htount和footValue
            user.htcount += 1;
            user.footValue += 1;
            s.reply(userName + '又看h图，大脚值+1，现在总大脚值为' + user.footValue);
        } else {
            s.reply(userName + '你一天看几次啊，长期观看h图可能导致心理上的依赖和成瘾，对个人的心理健康造成负面影响。这可能包括性欲增强、情感冷漠、自尊心下降、焦虑、抑郁和社交障碍等问题。');
            return; // 如果是，那就不再运行脚本
        }
    } else if (param1 === '今天看了h片') {
        //添加时间限制，每天运行前两次执行user.footValue += 2;，超过不执行
        if (!user.hasOwnProperty('hpcount') || !user.hasOwnProperty('hplastRunDay') || user.hplastRunDay !== today) {
            // 如果hpcount不存在，或者hplastRunDay不存在，或者最后一次的活动不是今天，那么重置hpcount
            user.hpcount = 1;
            user.hplastRunDay = today;
            user.footValue += 2;
            //获取当前时间
            let now = new Date();
            //获取当前小时分钟
            let hour = now.getHours();
            let minute = now.getMinutes();
            s.reply(hour + '点' + minute + '分' + userName + '就起来看h篇了，真是个色狼');
        } else if (user.hpcount < 2) {
            // 如果hpcount小于2，那么增加hpount和footValue
            user.hpcount += 1;
            user.footValue += 2;
            s.reply(userName + '又看h篇，大脚值+2，现在总大脚值为' + user.footValue);
        }
        else {
            s.reply(userName + '你一天看几次啊，沉迷于h篇可能导致对真实性关系的满足度降低，对伴侣的不忠和性关系的疏远，可能引发婚姻或伴侣关系的破裂。');
            return; // 如果是，那就不再运行脚本
        }

    } else if (param1 === '今天打了脚') {
        //添加时间限制，每天只能运行一次
        if (user.djlastRun === today) {
            s.reply(userName + '你一天打几次啊，过度自娱自乐可能导致性功能问题，如勃起功能障碍、早泄或延迟射精等。这可能会对性生活和性满足产生负面影响。');
            return; // 如果是，那就不再运行脚本
        } else {
            user.footValue += 3;
            user.djlastRun = today;
            await s.reply(userName + '，你的大脚值+3，现在总大脚值为' + user.footValue);
        }
    } else if (param1 === '大脚市场') {
        let cryptoNames = ['DOGE', 'BTC', 'ETH', 'PEPE'];
        let prices = await getCryptoPrice(cryptoNames);
        let messages = [];
        cryptoNames.forEach(cryptoName => {
            if (prices[cryptoName]) {
                messages.push(`${cryptoName}: 脚格=${prices[cryptoName].price}脚, 涨跌=${prices[cryptoName].changePercentage}`);
            } else {
                messages.push(`${cryptoName}: 无法获取价格`);
            }
        });

        s.reply(messages.join('\n'));
    } else if (param1 === '脚易') {
        // 提示用户输入命令
        await s.reply('请输入命令：\n 1. 购买货币：购买 <货币名> <数量> <杠杆倍数>\n 2. 卖出货币：卖出 <货币名> <数量>\n 3. 查看我的钱包：我的钱包');

        const inputCommand = await s.waitInput(() => { }, 60);
        let commands = inputCommand.getMsg().split(' ');

        // 如果是购买命令
        if (commands[0] === '购买') {
            await buyCoin(s, user, commands[1], Number(commands[2]), Number(commands[3]));
        }
        // 如果是卖出命令
        else if (commands[0] === '卖出') {
            await sellCoin(s, user, commands[1], Number(commands[2]));
        }
        // 如果是查看钱包命令
        else if (commands[0] === '我的钱包') {
            await showWallet(s, user);
        }
        else {
            await s.reply('命令错误');
        }

        // 记得在结束之后，更新数据库
        await footDb.set('FootUsers', footUsers);

        //通过用户大脚值等值usdt来购买加密货币，用户可以选择杠杆倍数，如果没有选择，则默认为1，然后将购买的加密货币存入用户的钱包中，买入的加密货币可以卖出变回大脚值，卖出的加密货币会从用户的钱包中扣除，一定数量的大脚值可以在大脚商店中购买商品
    }

    else if (param1 === '帮打') {
        await helpFoot(s, user, footUsers);
        await footDb.set('FootUsers', footUsers);
    } else if (param1 === '大脚市场') {
        await footmarket(s, user, footUsers);
    }
    else if (param1 === '大脚排名') {
        const ranking = await generateRanking(footUsers);
        await s.reply(ranking);
    } else if (param1 === '大脚指南') {
        s.reply(' 今天看了h图 \n 今天看了h片 \n 今天打了脚 \n 帮打    \n 大脚排名 \n 大脚指南 \n');
    } else if (param1 === '胶') {
        if (!await s.isAdmin()) {
            return
        }
        let user = s.param(3);
        let value = parseInt(await s.param(2));
        let targetUser = footUsers.find(u => u.name === user);
        if (!targetUser) {
            await s.reply('此用户不存在');
            return;
        }
        targetUser.footValue += value;
        await s.reply('成功为' + user + '充值' + value + '大脚值');
        await footDb.set('FootUsers', footUsers);
    } else if (param1 === '禅') {
        if (!await s.isAdmin()) {
            return
        }
        let user = s.param(2);
        let targetUser = footUsers.find(u => u.name === user);
        if (!targetUser) {
            await s.reply('此用户不存在');
            return;
        }
        targetUser.footValue = 0;
        await s.reply(user + '已圆寂');
        await footDb.set('FootUsers', footUsers);
    } else if (param1 === '打卡') {
        //获取用户名
        let footUsers = await footcheckDb.get('FootUsers') || [];
        let user = footUsers.find(u => u.id === userId);
        if (!user) {
            user = { id: userId, name: userName, checktimes: 0, checkdate: "0-0" };
            footUsers.push(user);
            await footcheckDb.set('footUsers', footUsers); // 仅在新用户加入时更新数据库   
        }
        //获取当前时间
        let now = new Date();
        //获取当前时间的月日
        let nowdate = now.getMonth() + 1 + '-' + now.getDate();
        if (user.checktimes === undefined) {
            user.checktimes = 0;
        }
        //今日未打卡，记录打卡时间，打卡时间+1
        if (user.checkdate != nowdate) {
            user.checkdate = nowdate;
            user.checktimes += 1;
            await s.reply(userName + '打卡成功，累计打卡次数为' + user.checktimes);
        } else {
            //今日已打卡，提示已打卡
            await s.reply('你已经打卡了哟，去找点别的事情做吧！累计打卡次数为' + user.checktimes);
        }
        //将打卡信息存入数据库
        await footcheckDb.set('FootUsers', footUsers);
    } else if (param1 === '打卡排名') {
        let footUsers = await footcheckDb.get('FootUsers') || [];
        if (footUsers.length === 0) {
            await s.reply('还没有人打卡呢！');
        } else {
            footUsers.sort((a, b) => b.checktimes - a.checktimes);  //降序排列，打卡次数多的在前

            let rankText = '打卡排名如下：\n';
            for (let i = 0; i < footUsers.length; i++) {
                rankText += (i + 1) + '. ' + footUsers[i].name + ': ' + footUsers[i].checktimes + '次\n';
            }

            await s.reply(rankText);
        }
    }

}