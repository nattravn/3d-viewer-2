//code from: https://stackblitz.com/edit/angular-async-click?file=app%2Fapp.component.ts

import {
	Directive,
	HostListener,
	Input,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	Renderer2,
	ElementRef,
} from '@angular/core';

import { Subscription, Observable, finalize } from 'rxjs';

@Directive({
	selector: '[asyncClick]',
})
export class AsyncClickDirective implements OnChanges, OnDestroy {
	private pending = true;
	private disabled = false;

	private subscription: Subscription;

	@Input('asyncClick') clickFunc: any;

	constructor(private _renderer: Renderer2, private _elementRef: ElementRef) {
	}

	@HostListener('click')
	onClick() {
		if (typeof this.clickFunc === 'function') {
			this.subscribe(this.clickFunc());
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		if (this.pending) {
			//this.enable();
		}
		if (this.subscription) {
			// this.subscription.unsubscribe();
		}
	}

	disable() {
		this._renderer.setAttribute(
			this._elementRef.nativeElement,
			'disabled',
			'true'
		);
	}

	enable() {
		this._renderer.removeAttribute(this._elementRef.nativeElement, 'disabled');
	}

	subscribe(r: Observable<any>) {
		//this.pending = true;
		this.disable();
		//const enable = () => this.enable();
		if (typeof r.subscribe === 'function') {
			this.subscription = r.pipe(
				finalize(() => {
					this.enable();
				}),
			).subscribe();
		}
	}

	ngOnDestroy() {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
}
