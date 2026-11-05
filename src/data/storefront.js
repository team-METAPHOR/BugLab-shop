// 메인 화면 연출용 정적 데이터. 상품 가격·재고 같은 서버 값은 넣지 않는다(서버 응답과 어긋나지 않게).

// 카테고리 메뉴는 검색어 바로가기다. 별도 카테고리 API를 두지 않는다.
export const CATEGORY_LINKS = [
  { label: '전체 상품', q: '' },
  { label: '키보드', q: '키보드', bubble: 'BEST' },
  { label: '마우스', q: '마우스' },
  { label: 'USB 허브', q: '허브' },
  { label: '데스크 매트', q: '매트' },
  { label: '모니터 받침대', q: '받침대' },
]

export const CATEGORY_SHORTCUTS = [
  { label: '키보드', q: '키보드', image: '/images/photos/wireless-keyboard.jpg' },
  { label: '마우스', q: '마우스', image: '/images/photos/silent-mouse.jpg' },
  { label: 'USB 허브', q: '허브', image: '/images/photos/usb-hub.jpg' },
  { label: '데스크 매트', q: '매트', image: '/images/photos/desk-mat.jpg' },
  { label: '모니터 받침대', q: '받침대', image: '/images/photos/monitor-stand.jpg' },
]

export const SUGGESTED_KEYWORDS = ['키보드', '마우스', '허브', '매트', '받침대']

// 메인 배너. to가 null이면 같은 화면의 상품 목록으로 스크롤한다.
export const HERO_SLIDES = [
  {
    id: 'setup-week',
    eyebrow: '11월 데스크 셋업 위크',
    title: ['책상 위를 가볍게,', '작업은 더 빠르게'],
    text: '키보드·마우스·액세서리 전 상품 무료 배송',
    image: '/images/photos/hero-desk.jpg',
    tone: 'dark',
    bg: '#1c1e1d',
    to: null,
  },
  {
    id: 'coupon',
    eyebrow: '장바구니 쿠폰',
    title: ['SAVE5000 입력하면', '5,000원 즉시 할인'],
    text: '최소 주문 금액 없이 장바구니에서 바로',
    coupon: true,
    tone: 'light',
    bg: '#ebe5da',
    to: '/cart',
  },
  {
    id: 'keyboard',
    eyebrow: 'BugLab 무선 키보드',
    title: ['조용하고 가벼운', '타건감'],
    text: '2.4GHz 무선 · 둥근 저소음 키캡',
    image: '/images/photos/wireless-keyboard.jpg',
    tone: 'light',
    bg: '#e6e5e1',
    to: '/products/1',
  },
  {
    id: 'mouse',
    eyebrow: 'BugLab 저소음 마우스',
    title: ['클릭 소리 걱정 없이', '밤에도 집중'],
    text: '도서관·사무실에서도 편하게',
    image: '/images/photos/silent-mouse.jpg',
    tone: 'light',
    bg: '#e9e9e4',
    to: '/products/2',
  },
  {
    id: 'stand',
    eyebrow: '원목 모니터 받침대',
    title: ['시선은 높이,', '책상은 넓게'],
    text: '하부 수납 선반으로 정리까지',
    image: '/images/photos/monitor-stand.jpg',
    tone: 'light',
    bg: '#ede6dc',
    to: '/products/6',
  },
  {
    id: 'hub',
    eyebrow: '7포트 USB 3.0 멀티 허브',
    title: ['포트 부족은', '이제 그만'],
    text: '노트북 하나로 주변기기 7개 연결',
    image: '/images/photos/usb-hub.jpg',
    tone: 'dark',
    bg: '#242725',
    to: '/products/4',
  },
]

// 메인 "처음 책상 세트" 안내. 문구는 상품 설명·상품 정보 표(productSpecs.js)에 있는 사실만 쓴다. 가격은 넣지 않는다.
export const SETUP_GUIDE = {
  image: '/images/photos/desk-mat.jpg',
  title: ['처음 꾸미는 책상,', '세 가지부터'],
  reason: '타건 소리와 클릭 소리를 줄인 조합입니다. 키보드와 마우스를 매트 한 장 위에 함께 올릴 수 있습니다.',
  items: [
    { id: 1, role: '키보드', name: 'BugLab 무선 키보드', fact: '둥근 저소음 키캡 · 2.4GHz 무선' },
    { id: 2, role: '마우스', name: 'BugLab 저소음 마우스', fact: '3버튼 저소음 스위치 · 약 72g' },
    { id: 5, role: '매트', name: '데스크 매트 XL', fact: '900 × 400mm 울 펠트' },
  ],
}

export const BENEFITS = [
  { icon: 'truck', title: '무료 배송', text: '금액 조건 없이 전 상품' },
  { icon: 'return', title: '7일 무료 반품', text: '받은 날부터 7일 이내' },
  { icon: 'clock', title: '평일 당일 출고', text: '오후 2시 이전 주문 기준' },
]
