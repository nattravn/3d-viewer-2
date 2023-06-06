import { Inject, Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeValue } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

//https://stackoverflow.com/questions/70015443/angular-how-to-display-text-without-the-html-tags
@Pipe({
	name: 'safeHtml',
})
export class SafeHtmlPipe implements PipeTransform {

	constructor(
		@Inject(DomSanitizer) private readonly sanitizer: DomSanitizer,
	) {}

	public transform(value: string): SafeHtml {
		const sanitizedContent = DOMPurify.sanitize(value);
		const safeHtml = this.sanitizer.sanitize(SecurityContext.HTML, value) || '';
		//console.log("safeHtml: ", safeHtml);
		//console.log("sanitizedContent: ", sanitizedContent);
		//console.log("value: ", value);
		return this.sanitizer.bypassSecurityTrustHtml(value);

	}
}
