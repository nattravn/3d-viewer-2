export class InfoBoxContent {
	public heading: string;

	public description: string;
}


export class InfoBox {
	public swedish = new InfoBoxContent;

	public english = new InfoBoxContent;

	constructor(descriptionEng: string, headingEng: string, descriptionSwe: string, headingSwe: string) {
		this.english.description = descriptionEng;
		this.english.heading = headingEng;
		this.swedish.description = descriptionSwe;
		this.swedish.heading = headingSwe;
	}
}
