import { defineMessages } from '../preferences/Preferences';

export const pairingMessages = defineMessages({
  label: '声间 / 我的电脑', title: '让手机连接这台音乐电脑',
  intro: '电脑保持运行。手机连接同一 Wi-Fi，在移动端输入下面的电脑地址。',
  address: '音乐电脑地址', connect: '输入地址后点“连接电脑”，即可打开音乐项目。',
  refresh: '刷新电脑地址', loading: '正在读取电脑地址…',
  missingLan: '这台电脑尚未启用局域网连接入口。启用后刷新电脑地址。',
  readFailed: '暂时无法读取电脑地址，请稍后刷新。',
}, {
  label: 'Shengjian / My computer', title: 'Connect your phone to this music computer',
  intro: 'Keep the computer running. Connect your phone to the same Wi-Fi, then enter the address below in the mobile app.',
  address: 'Music computer address', connect: 'Enter the address and tap Connect computer to open your music projects.',
  refresh: 'Refresh computer address', loading: 'Reading the computer address…',
  missingLan: 'This computer has not enabled its LAN connection. Enable it, then refresh the address.',
  readFailed: 'The computer address is unavailable. Try refreshing shortly.',
});
