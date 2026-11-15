import { Type } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const isAdmin = location.hostname.startsWith('admin.') || (isLocal && location.pathname.startsWith('/admin'));

const root: Promise<Type<unknown>> = isAdmin
  ? import('./app/admin/admin.component').then((m) => m.AdminComponent)
  : Promise.resolve(AppComponent);

root
  .then((component) => bootstrapApplication(component, appConfig))
  .catch((err) => console.error(err));
