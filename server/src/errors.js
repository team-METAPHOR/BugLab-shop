const MESSAGES = {
  VALIDATION_ERROR: '입력값을 확인해 주세요.',
  UNAUTHENTICATED: '로그인이 필요합니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  TEST_TOKEN_INVALID: '테스트 토큰이 올바르지 않습니다.',
  NOT_TEST_ACCOUNT: '테스트 계정만 초기화할 수 있습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다.',
  CART_ITEM_NOT_FOUND: '장바구니에 없는 상품입니다.',
  FAVORITE_NOT_FOUND: '찜 목록에 없는 상품입니다.',
  COUPON_NOT_FOUND: '존재하지 않는 쿠폰입니다.',
  EMAIL_TAKEN: '이미 가입된 이메일입니다.',
  OUT_OF_STOCK: '품절된 상품입니다.',
  QUANTITY_OUT_OF_RANGE: '수량은 1개 이상 {max}개 이하로 선택할 수 있습니다.',
  CART_EMPTY: '장바구니가 비어 있습니다.',
  COUPON_ALREADY_APPLIED: '이미 적용된 쿠폰입니다.',
  UNSUPPORTED_MEDIA_TYPE: 'JSON 요청만 지원합니다.',
  TOO_MANY_ATTEMPTS: '잠시 후 다시 시도해 주세요.',
  INTERNAL_ERROR: '일시적인 오류가 발생했습니다.',
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message ?? MESSAGES[code] ?? code);
    this.status = status;
    this.code = code;
  }
}

export function quantityOutOfRange(max) {
  return new ApiError(409, 'QUANTITY_OUT_OF_RANGE', MESSAGES.QUANTITY_OUT_OF_RANGE.replace('{max}', String(max)));
}

export function validationError(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

export function sendError(res, err) {
  res.status(err.status).json({ error: { code: err.code, message: err.message } });
}
