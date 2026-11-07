import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Barrio Backend API 🏘️',
      version: '1.0.0',
      description:
        'API RESTful robusta y segura para la plataforma vecinal comunitaria Barrio. Construida con Node.js, Express, TypeScript y Supabase.',
      contact: {
        name: 'Barrio Engineering Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor Local de Desarrollo (/api)',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor Local Versionado (/api/v1)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Introduce el token JWT de acceso obtenido tras autenticarse con Supabase Auth (Bearer <token>)',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
