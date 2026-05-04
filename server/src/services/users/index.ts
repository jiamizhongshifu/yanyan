/**
 * users 服务占位
 *
 * U3 接入:
 *   - createUser(wxOpenid):wx.login → code2session → 生成 DEK(KMS)+ 写入 users 表
 *   - softDelete(userId):撤回同意时的软删除 + KMS.scheduleKeyDeletion
 *   - hardDelete(userId):cron 30 天后触发 + DEK 永久销毁
 */

export {};
