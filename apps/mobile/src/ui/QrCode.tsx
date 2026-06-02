import { color } from '@getsava/ui';
import { StyleSheet, View } from 'react-native';
import StyledQRCode from 'react-native-qrcode-styled';
import { Icon } from './Icon';

interface QrCodeProps {
  /** The exact string the QR encodes (e.g. a Stellar address). */
  value: string;
  /** White card edge length. */
  size?: number;
  /** Show the USDC badge in the center. */
  badge?: boolean;
}

/** A real (scannable) QR rendered on a white rounded card, USDC badge centered. */
export function QrCode({ value, size = 176, badge = true }: QrCodeProps) {
  const pieceSize = Math.max(3, Math.floor((size - 26) / 37));
  return (
    <View style={[styles.card, { width: size, height: size }]}>
      <StyledQRCode
        data={value}
        pieceSize={pieceSize}
        color="#0c0c0f"
        style={styles.qr}
        errorCorrectionLevel="M"
      />
      {badge ? (
        <View style={styles.badge}>
          <Icon name="usdc" size={20} stroke={color.purple} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 13,
  },
  qr: { backgroundColor: 'transparent' },
  badge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 38,
    height: 38,
    marginTop: -19,
    marginLeft: -19,
    borderRadius: 19,
    backgroundColor: color.purple,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
