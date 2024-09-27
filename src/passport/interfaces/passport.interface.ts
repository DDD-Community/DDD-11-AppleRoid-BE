export interface PhoneTokenPayload {
  passportAuthId: number;
  phoneNumber: string;
}

export interface TokenPayload {
  id?: number;
  passportAuthId: number;
}
