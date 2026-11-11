import { ChangeDetectionStrategy, Component, HostListener, OnInit, ViewEncapsulation, signal } from '@angular/core';

const CIRCUMFERENCE = 2 * Math.PI * 20;

@Component({
  selector: 'fsu-scroll-top',
  templateUrl: './scroll-top.component.html',
  styleUrl: './scroll-top.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollTopComponent implements OnInit {
  readonly visible = signal(false);
  readonly dashOffset = signal(CIRCUMFERENCE);

  ngOnInit(): void {
    this.update();
  }

  @HostListener('window:scroll')
  update(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    this.visible.set(scrollTop > 200);
    if (docHeight > 0) {
      this.dashOffset.set(Math.max(0, CIRCUMFERENCE - (scrollTop / docHeight) * CIRCUMFERENCE));
    }
  }

  toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
