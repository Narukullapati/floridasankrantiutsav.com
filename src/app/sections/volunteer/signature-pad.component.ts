import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';

const MAX_EXPORT_WIDTH = 600;

@Component({
  selector: 'fsu-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fsu-sig">
      <canvas
        #canvas
        class="fsu-sig-canvas"
        [class.is-invalid]="invalid()"
        role="img"
        aria-label="Signature pad: draw your signature with a mouse, finger or stylus"
        (pointerdown)="start($event)"
        (pointermove)="move($event)"
        (pointerup)="end()"
        (pointercancel)="end()"
        (pointerleave)="end()"
      ></canvas>
      <div class="fsu-sig-foot">
        <span>Sign above with your mouse, finger or stylus.</span>
        <button type="button" class="fsu-sig-clear" (click)="clear()">Clear</button>
      </div>
    </div>
  `,
})
export class SignaturePadComponent {
  readonly invalid = input(false);
  readonly signed = output<string | null>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private ctx: CanvasRenderingContext2D | null = null;
  private last: { x: number; y: number } | null = null;
  private drawn = false;

  constructor() {
    afterNextRender(() => this.resize());
  }

  private resize(): void {
    const canvas = this.canvas().nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = '#0f172a';
    this.ctx = ctx;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  start(event: PointerEvent): void {
    const canvas = this.canvas().nativeElement;
    if (!this.ctx || canvas.width !== Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1))) {
      if (!this.drawn) this.resize();
    }
    if (!this.ctx) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    this.last = this.point(event);
    this.ctx.beginPath();
    this.ctx.arc(this.last.x, this.last.y, 1.2, 0, Math.PI * 2);
    this.ctx.fill();
    this.drawn = true;
  }

  move(event: PointerEvent): void {
    if (!this.last || !this.ctx) return;
    const p = this.point(event);
    this.ctx.beginPath();
    this.ctx.moveTo(this.last.x, this.last.y);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.last = p;
  }

  end(): void {
    if (!this.last) return;
    this.last = null;
    this.signed.emit(this.export());
  }

  clear(): void {
    this.drawn = false;
    this.last = null;
    this.resize();
    this.signed.emit(null);
  }

  private export(): string | null {
    if (!this.drawn) return null;
    const canvas = this.canvas().nativeElement;
    const scale = Math.min(1, MAX_EXPORT_WIDTH / canvas.width);
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }
}
