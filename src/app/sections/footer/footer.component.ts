import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { VolunteerModalService } from '../volunteer/volunteer-modal.service';

@Component({
  selector: 'fsu-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
  readonly volunteerModal = inject(VolunteerModalService);
}
