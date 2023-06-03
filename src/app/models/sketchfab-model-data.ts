import { Annotation } from "./annotation.model";
import { InfoBox } from "./info-box-content.model";

export class SketchFabModelData {
	public animationTime: number;

	public resetModelTime: number;

	public spinVelocity: number;

	public orbitPanFactor: number;

	public orbitRotationFactor: number;

	public orbitZoomFactor: number;

	public logCamera: boolean;

	public rotAxis: { x:number, y:number, z:number };

	public annotations: Array<Annotation>;

	public helpInfo: InfoBox;

	public modelIndex: number | undefined;

	public imageUrl: string;

	public slug: string;
}
