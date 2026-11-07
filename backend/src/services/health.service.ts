import { supabaseAdmin } from '../config/supabase';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    error?: string;
  };
}

export class HealthService {
  public async getHealth(): Promise<HealthStatus> {
    let dbConnected = false;
    let dbError: string | undefined;

    try {
      // Query liviana a la tabla de zonas o settings para verificar conectividad con Supabase
      const { error } = await supabaseAdmin.from('zones').select('id').limit(1);
      if (error) {
        dbError = error.message;
      } else {
        dbConnected = true;
      }
    } catch (err) {
      dbError = err instanceof Error ? err.message : 'Error desconocido al conectar con base de datos';
    }

    return {
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: dbConnected,
        error: dbError,
      },
    };
  }
}

export const healthService = new HealthService();
