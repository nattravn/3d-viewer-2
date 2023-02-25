import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ViewerComponent } from './viewer/viewer.component';

const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'viewer' },
	{ path: 'viewer', component: ViewerComponent },
];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule],
})
export class AppRoutingModule { }
