import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { decodeFirestoreValue, encodeFirestoreValue } from '../firestore/firestoreCodec';
import { userVehicleSchema } from '../schemas/premiumSchemas';
import { fixedDate, userVehicleFixture } from './fixtures';

describe('Firestore codec', () => {
  it('converts nested domain dates to Firestore timestamps', () => {
    const encoded = encodeFirestoreValue(userVehicleFixture);
    if (typeof encoded !== 'object' || encoded === null || !('createdAt' in encoded) || !('updatedAt' in encoded)) {
      throw new TypeError('Expected an encoded Firestore document');
    }
    expect(encoded.createdAt).toBeInstanceOf(Timestamp);
    expect(encoded.updatedAt).toBeInstanceOf(Timestamp);
  });

  it('converts timestamps back before validating the document', () => {
    const roundTrip = userVehicleSchema.parse(decodeFirestoreValue(encodeFirestoreValue(userVehicleFixture)));
    expect(roundTrip).toEqual(userVehicleFixture);
    expect(roundTrip.createdAt).toEqual(fixedDate);
  });

  it('omits undefined fields from Firestore documents', () => {
    expect(encodeFirestoreValue({ retained: 'value', omitted: undefined })).toEqual({ retained: 'value' });
  });
});
