import dotenv from 'dotenv';
dotenv.config();
import {ApplicationModule} from './app.module';
import {NestFactory} from '@nestjs/core';
import {Logger} from '@nestjs/common';
import {SwaggerModule, DocumentBuilder} from '@nestjs/swagger';
import {NestExpressApplication} from '@nestjs/platform-express';

var path = require('path');
var express = require('express');

const portNumber = process.env.COPPER_SERVER_PORT ? process.env.COPPER_SERVER_PORT : 3007;

export class Server {
  private server: NestExpressApplication;

  constructor() {
    this.StartNestServerAsync()
      .then(server => Logger.log('COPPER Server Started'))
      .catch(reason => Logger.log('Failed to start COPPER Server'));
  }

  // Setup NEST.JS REST server
  async StartNestServerAsync(): Promise<NestExpressApplication> {
    // Create the server
    const app = await NestFactory.create<NestExpressApplication>(ApplicationModule, {cors: true /* enable preflight cors */});

    // Add response header to all incomming requests
    // Use express from this
    app.use((req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*'); // Disable CORS (not for production)
      res.header('Access-Control-Allow-Origin', 'http://localhost:8080'); // Disable CORS (not for production)
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Credentials', true);
      next();
    });
//     /*
//     NEST.JS also supports CORS:
//     const corsOptions = {
//       "origin": "*",
//       "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
//       "preflightContinue": false,
//       "optionsSuccessStatus": 204,

//     }
//     app.enableCors(corsOptions); // Allows all clients
// */

    // Serve the public folder directory
    const publicDirectory: string = path.join(process.cwd(), 'public');
    app.use('/public', express.static(publicDirectory));
    Logger.log(`'http://localhost:${portNumber}/public': Host files from '${publicDirectory}'`);

    // Create swagger documentation
    const options = new DocumentBuilder()
      .setTitle('COPPR server')
      .setDescription('Coppr server API description')
      .setVersion('1.0')
      .addTag('COPPR')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api', app, document); // http://<host>:<port>/api
    Logger.log(`'http://localhost:${portNumber}/api': OpenApi (swagger) documentation.`);
    Logger.log(`'http://localhost:${portNumber}/api-json': OpenApi (swagger) definition. `);

    // Start server
    await app.listen(portNumber);
    return app;
  }
}
