declare module 'react-native-qrcode-styled' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface QRCodeStyledProps {
    data: string;
    pieceSize?: number;
    pieceBorderRadius?: number | number[];
    padding?: number;
    color?: string;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    style?: StyleProp<ViewStyle>;
  }

  const QRCodeStyled: ComponentType<QRCodeStyledProps>;
  export default QRCodeStyled;
}
