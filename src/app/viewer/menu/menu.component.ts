import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	Input,
	OnInit,
	QueryList,
	ViewChild,
	ViewChildren,
} from '@angular/core';

import {
	BehaviorSubject,
	delay,
	filter,
	map,
	Observable,
	of,
	ReplaySubject,
	Subject,
	switchMap,
	takeUntil,
	tap,
} from 'rxjs';

import { InfoBoxContent } from '@app/models/info-box-content.model';
import { SketchfabService } from '@app/services/sketchfab.service';
import { LanguageEnum } from '@enum/language.enum';
import { Language, ViewerComponent } from '@viewer/viewer.component';

@Component({
	selector: 'app-menu',
	templateUrl: './menu.component.html',
	styleUrls: ['./menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent implements OnInit {
	// eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
	@Input() sketchfabServices: SketchfabService[] | null;

	public readonly BASE_URL = 'http://localhost:8080/wordpress/';

	public annotationDescription$ = new ReplaySubject<string>(1);

	public annotationHeading$ = new ReplaySubject<string>(1);

	public helpInfoHeading$ = new ReplaySubject<string>(1);

	public helpInfoText$ = new ReplaySubject<string>(1);

	public showClickableLayer$ = new ReplaySubject<boolean>(1);

	public selectedLanguage$ = new BehaviorSubject<Language>(LanguageEnum.english);

	// Replay subject instead??
	public infoBlockIsVisible = false;

	public annotationBlockIsVisible = false;

	public selectedAnnotation = 0;

	public languageEnum = LanguageEnum;

	private startSpinningInterval$ = new BehaviorSubject<boolean>(true);

	/**
	 * Subject to handle unsubscribe
	 */
	private untilDestroyed$ = new Subject<boolean>();

	constructor(public sketchfabService: SketchfabService) {}
	ngOnInit(): void {
		if (this.sketchfabServices) {
			this.sketchfabService.selectedSketchfabService$.next(this.sketchfabServices[0]);
		}
	}

	public selectModel$(
		sketchfabServicePrev: SketchfabService,
		sketchfabServiceNext: SketchfabService,
		selectedLanguage: Language,
	): Observable<boolean> {
		sketchfabServicePrev.spinning = false;

		// TODO Target the element in a more Angular way
		const iframeElement = document.getElementById(`viewerRef-${sketchfabServiceNext.modelIndex}`);
		if (iframeElement && sketchfabServiceNext.modelIndex != null) {
			iframeElement.scrollIntoView();
		}

		return sketchfabServicePrev.setLDtexture(sketchfabServicePrev.api).pipe(
			takeUntil(this.untilDestroyed$),
			filter((texture) => texture),
			switchMap(() =>
				sketchfabServicePrev
					.setInitCameraPos(
						0,
						sketchfabServicePrev.annotations[0].cameraPosition,
						sketchfabServicePrev.annotations[0].cameraTarget,
						sketchfabServicePrev.api,
						0.01,
					)
					.pipe(
						delay(sketchfabServicePrev.resetModelTime),
						switchMap(() => {
							sketchfabServicePrev.cameraIsMoving = false;
							this.startSpinningInterval$.next(true);
							// TODO other solution than next outside service
							this.sketchfabService.selectedSketchfabService$.next(sketchfabServiceNext);

							return sketchfabServiceNext.setHDtexture(sketchfabServiceNext.api).pipe(
								filter((texture) => texture),
								tap(() => {
									console.log('Texture loaded hd');
									this.annotationDescription$.next(sketchfabServiceNext.annotations[0][selectedLanguage].description);
									this.annotationHeading$.next(sketchfabServiceNext.annotations[0][selectedLanguage].heading);

									return true;
								}),
							);
						}),
					),
			),
		);
	}

	public showAnnotationBlock(
		annotationBlockIsVisible: boolean,
		selectedSketchfabService: SketchfabService,
		selectedLanguage: Language,
	): void {
		// this.stopSpinning(selectedSketchfabService);

		this.annotationDescription$.next(
			selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description,
		);
		this.annotationHeading$.next(selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);
		this.annotationBlockIsVisible = annotationBlockIsVisible ? false : true;
		this.infoBlockIsVisible = false;
	}

	public showInfoBlock(infoBlockIsVisible: boolean, selectedSketchfabService: SketchfabService, selectedLanguage: Language) {
		this.helpInfoHeading$.next(selectedSketchfabService.helpInfo[selectedLanguage].heading);
		this.helpInfoText$.next(selectedSketchfabService.helpInfo[selectedLanguage].description);
		this.infoBlockIsVisible = infoBlockIsVisible ? false : true;
		this.annotationBlockIsVisible = false;
	}

	public toggleLanguage(boxContent: InfoBoxContent, selectedLanguage: Language) {
		this.annotationDescription$.next(boxContent.description);
		this.annotationHeading$.next(boxContent.heading);

		this.helpInfoText$.next(boxContent.description);
		this.helpInfoHeading$.next(boxContent.heading);

		this.selectedLanguage$.next(selectedLanguage);
	}

	public previousAnnotation$(sketchfabService: SketchfabService, selectedLanguage: Language): Observable<boolean> {
		if (this.selectedAnnotation > 0) {
			this.selectedAnnotation--;
		} else {
			this.selectedAnnotation = sketchfabService.annotations.length - 1;
		}

		// If the model is in spinning mode when user opens the annotation box
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);

		return sketchfabService
			.changeAnnotation(
				sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
				sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
				sketchfabService.animationTime,
				sketchfabService.api,
			)
			.pipe(
				takeUntil(this.untilDestroyed$),
				takeUntil(sketchfabService.changingAnnotation$),
				tap(() => {
					// sketchfabService.cameraIsMoving = false;
				}),
			);
	}

	public nextAnnotation$(sketchfabService: SketchfabService, selectedLanguage: Language): Observable<boolean> {
		if (this.selectedAnnotation < sketchfabService.annotations.length - 1) {
			this.selectedAnnotation++;
		} else {
			this.selectedAnnotation = 0;
		}

		// If the model is in spinning mode when user opens the annotation box
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);

		return sketchfabService
			.changeAnnotation(
				sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
				sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
				sketchfabService.animationTime,
				sketchfabService.api,
			)
			.pipe(
				takeUntil(this.untilDestroyed$),
				takeUntil(sketchfabService.changingAnnotation$),
				tap(() => {
					// sketchfabService.cameraIsMoving = false;
				}),
			);
	}

	public resetModel$(
		api: any,
		lightStates: Array<number[]> | null,
		sketchfabService: SketchfabService,
		selectedLanguage: Language,
	): Observable<string> {
		sketchfabService.spinning = false;
		if (!lightStates) {
			return of('debug');
		}
		this.selectedAnnotation = 0;

		// reset light positions
		if (lightStates.length) {
			sketchfabService.setLights(api, lightStates);
		}
		this.annotationDescription$.next(sketchfabService.annotations[0][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[0][selectedLanguage].heading);

		return sketchfabService
			.setInitCameraPos(
				0,
				sketchfabService.annotations[0].cameraPosition,
				sketchfabService.annotations[0].cameraTarget,
				sketchfabService.api,
				sketchfabService.resetModelTime,
			)
			.pipe(
				takeUntil(this.untilDestroyed$),
				delay(sketchfabService.resetModelTime * 1000),
				map(() => {
					// Delete this when it is updated in api.addEventListener('camerastop') ??
					sketchfabService.cameraIsMoving = false;
					this.startSpinningInterval$.next(true);
					return 'debug';
				}),
			);
	}
}
