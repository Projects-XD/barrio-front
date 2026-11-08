import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinCastilla } from './castilla';

test('el centro de Castilla está dentro del distrito', () => {
  assert.equal(isWithinCastilla({ lat: -5.1116108, lng: -80.5354521 }), true);
});

test('Piura ciudad y Sullana quedan fuera', () => {
  assert.equal(isWithinCastilla({ lat: -5.194, lng: -80.632 }), false);
  assert.equal(isWithinCastilla({ lat: -4.9, lng: -80.7 }), false);
});
