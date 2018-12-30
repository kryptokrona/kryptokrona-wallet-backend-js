// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

export function isHex64 (key: string) {
  const regex = new RegExp('^[0-9a-fA-F]{64}$')
  return regex.test(key)
}
