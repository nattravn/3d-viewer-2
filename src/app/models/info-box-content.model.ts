export class InfoBoxContent {
	public heading: string;

	public description: string;

	constructor(heading: string, description: string) {
		this.heading = heading;
		this.description = description;
	}
}


export class InfoBox {
	public swedish: InfoBoxContent;

	public english: InfoBoxContent;

	constructor(descriptionEng: string, headingEng: string, descriptionSwe: string, headingSwe: string) {
		this.english = new InfoBoxContent(headingEng, descriptionEng);
		this.swedish = new InfoBoxContent(headingSwe, descriptionSwe);
	}
}
