import { describe, expect, it } from 'vitest';
import { allowedAdminResource } from './knowledgeAdmin.mjs';

describe('administración privada', () => {
  it('reserva usuarios y suscripciones al administrador', () => {
    expect(allowedAdminResource('users', ['admin'])).toBe(true);
    expect(allowedAdminResource('users', ['editor'])).toBe(false);
    expect(allowedAdminResource('subscriptions', ['reviewer'])).toBe(false);
  });

  it('permite diagnósticos a los roles editoriales y rechaza recursos desconocidos', () => {
    expect(allowedAdminResource('diagnostics', ['reviewer'])).toBe(true);
    expect(allowedAdminResource('diagnostics', ['editor'])).toBe(true);
    expect(allowedAdminResource('secrets', ['admin'])).toBe(false);
  });
});
