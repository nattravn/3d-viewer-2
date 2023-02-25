import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewerComponent } from './viewer.component';
import { MenuComponent } from './menu/menu.component';
import { AnnotationNavComponent } from './annotation-nav/annotation-nav.component';
import { SketchfabService } from '../services/sketchfab.service';
import { WordpressService } from '../services/wordpress.service';
import { HttpClientModule } from '@angular/common/http';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';


@NgModule({
	imports: [
		CommonModule,
		HttpClientModule,
	],
	declarations: [
		ViewerComponent,
		MenuComponent,
		AnnotationNavComponent,
		SafeHtmlPipe,
	],
	providers: [
		SketchfabService,
		WordpressService,
	],
})
export class ViewerModule { }
