const numberFormat = new Intl.NumberFormat('ko-KR')

export function won(amount) {
  return `${numberFormat.format(amount)}원`
}

export function discountWon(amount) {
  return amount > 0 ? `-${won(amount)}` : '0원'
}
