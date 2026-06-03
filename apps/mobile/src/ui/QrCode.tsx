import { StyleSheet, View } from 'react-native';
import StyledQRCode from 'react-native-qrcode-styled';
import { UsdcMark } from './brand-icons';

interface QrCodeProps {
  /** The exact string the QR encodes (e.g. a Stellar address). */
  value: string;
  /** White card edge length. */
  size?: number;
  /** Show the USDC badge in the center. */
  badge?: boolean;
}

const BADGE = 40;

/** A real (scannable) QR on a white rounded card, USDC coin mark centered. */
export function QrCode({ value, size = 176, badge = true }: QrCodeProps) {
  const pieceSize = Math.max(3, Math.floor((size - 26) / 37));
  return (
    <View style={[styles.card, { width: size, height: size }]}>
      {/* Wrapper hugs the QR exactly; the badge overlay fills it and centers,
          so the mark sits dead-center on the QR (not the padded card). */}
      <View>
        <StyledQRCode
          data={value}
          pieceSize={pieceSize}
          color="#0c0c0f"
          // High error correction so the center USDC mark never breaks the scan.
          errorCorrectionLevel="H"
        />
        {badge ? (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.badge}>
              <UsdcMark size={BADGE - 6} />
            </View>
          </View>
        ) : null}
      </View>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
