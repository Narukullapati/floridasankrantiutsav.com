import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'fsu-whatsapp',
  templateUrl: './whatsapp.component.html',
  styleUrl: './whatsapp.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsappComponent {}
