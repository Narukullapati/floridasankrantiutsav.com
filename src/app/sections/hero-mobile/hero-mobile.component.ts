import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'fsu-hero-mobile',
  templateUrl: './hero-mobile.component.html',
  styleUrl: './hero-mobile.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroMobileComponent {}
