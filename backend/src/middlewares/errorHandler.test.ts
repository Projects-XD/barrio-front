import test from 'node:test';
import assert from 'node:assert/strict';
import { dbError } from './errorHandler';

test('un RAISE EXCEPTION propio de la base (P0001) llega al vecino con su mensaje', () => {
  const err = dbError('Error al crear el favor', { message: 'Ya publicaste ese favor hoy.', code: 'P0001' });
  assert.equal(err.message, 'Ya publicaste ese favor hoy.');
  assert.equal(err.statusCode, 400);
});

test('cualquier otro error de la base no filtra nombres de tablas ni columnas', () => {
  const err = dbError('Error al consultar favores', {
    message: 'column favors.secret does not exist',
    code: '42703',
  });
  assert.equal(err.message, 'Error al consultar favores');
});

test('dbError respeta el codigo HTTP indicado', () => {
  assert.equal(dbError('Error', { message: 'x' }, 500).statusCode, 500);
});
