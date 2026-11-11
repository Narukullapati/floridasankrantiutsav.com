import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AboutComponent } from './sections/about/about.component';
import { ActivitiesComponent } from './sections/activities/activities.component';
import { CtaComponent } from './sections/cta/cta.component';
import { FooterComponent } from './sections/footer/footer.component';
import { HeaderComponent } from './sections/header/header.component';
import { HeroMobileComponent } from './sections/hero-mobile/hero-mobile.component';
import { HeroComponent } from './sections/hero/hero.component';
import { ScheduleComponent } from './sections/schedule/schedule.component';
import { ScrollTopComponent } from './sections/scroll-top/scroll-top.component';
import { WhatsappComponent } from './sections/whatsapp/whatsapp.component';

@Component({
  selector: 'app-root',
  imports: [
    HeaderComponent,
    HeroComponent,
    HeroMobileComponent,
    AboutComponent,
    ActivitiesComponent,
    ScheduleComponent,
    CtaComponent,
    ScrollTopComponent,
    WhatsappComponent,
    FooterComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
