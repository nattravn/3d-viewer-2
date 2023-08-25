import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { AsyncClickDirective } from '../directives/async-click.directive';
import { FallbackImgDirective } from '../directives/my-directive.directive';
import { SketchFabModelData } from '../models/sketchfab-model-data';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { SketchfabService } from '../services/sketchfab.service';
import { WordpressService } from '../services/wordpress.service';
import { AnnotationNavComponent } from './annotation-nav/annotation-nav.component';
import { MenuComponent } from './menu/menu.component';
import { ViewerComponent } from './viewer.component';

@NgModule({
	imports: [CommonModule, HttpClientModule],
	declarations: [
		ViewerComponent,
		MenuComponent,
		AnnotationNavComponent,
		SafeHtmlPipe,
		FallbackImgDirective,
		AsyncClickDirective,
	],
	providers: [SketchfabService, WordpressService, SketchFabModelData],
})
export class ViewerModule {}
