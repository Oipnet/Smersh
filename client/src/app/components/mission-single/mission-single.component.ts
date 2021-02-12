import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MissionsService } from '../../services/missions.service';
import { FormBuilder, FormGroup, NgForm } from '@angular/forms';
import { ThemePalette } from '@angular/material/core';
import { UploadsService } from '../../services/uploads.service';
import { HostsService } from '../../services/hosts.service';
import { FileInformation } from '../../file-information';
import { MatSnackBar } from '@angular/material/snack-bar';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import PizZipUtils from 'pizzip/utils/index.js';
import { saveAs } from 'file-saver';
import { Locale } from 'src/app/storage/Locale';

function loadFile(url, callback) {
  PizZipUtils.getBinaryContent(url, callback);
}

@Component({
  selector: 'app-mission',
  templateUrl: './mission-single.component.html',
  styleUrls: ['./mission-single.component.css'],
})
export class MissionSingleComponent implements OnInit {
  @ViewChild('fileInput')
  fileInput: ElementRef;
  color: ThemePalette = 'primary';
  durationInSeconds = 4;
  public mission: any;
  public nmap: boolean;
  public nessus: boolean;
  hosts: any;
  missionName: any;
  users: any;
  creds: any;
  clients: any;
  file: any;
  id: any;
  public missionId: string;
  public currentLocal = new Locale().get();

  uploadForm: FormGroup;

  fileInformation: FileInformation;

  constructor(
    private route: ActivatedRoute,
    private _snackBar: MatSnackBar,
    private hostsService: HostsService,
    private router: Router,
    private missionsService: MissionsService,
    private uploadServices: UploadsService,
    private fb: FormBuilder
  ) {
    this.missionId = this.router.url.split('/').pop();
  }

  done(host): void {
    const idHost = host['@id'].split('/').pop();
    if (host.checked === false) {
      this.hostsService.update(idHost, { checked: true }).subscribe(() => {
        //     console.log("Host checked updated ");
        this.openSnackBar(host.name + ' updated To True ');
        this.ngOnInit();
      });
    } else {
      this.hostsService.update(idHost, { checked: false }).subscribe(() => {
        //        console.log("Host checked updated ");
        this.openSnackBar(host.name + ' updated To False ');
        this.ngOnInit();
      });
    }
  }

  nmapUpdate(isChecked): void {
    this.missionsService
      .update(this.missionId, { nmap: isChecked })
      .subscribe();
  }

  nessusUpdate(isChecked) {
    this.missionsService
      .update(this.missionId, { nessus: isChecked })
      .subscribe();
  }

  openSnackBar(message): void {
    this._snackBar.open(message, '', {
      duration: this.durationInSeconds * 1000,
    });
  }

  ngOnInit(): void {
    this.loadData(this.missionId);

    this.uploadForm = this.fb.group({
      filename: '',
      userFile: null,
    });
  }

  loadData(id: string): void {
    this.missionsService.getDataById(id).subscribe((response) => {
      this.mission = response;
      this.missionName = response.name;
      this.hosts = response['hosts'].map((host) => ({
        ...host,
        vulns: host.vulns.map((vuln) => ({
          ...vuln,
          translate: vuln.translations[this.currentLocal] ?? {},
        })),
        name: `${host.name.match(/^((https?|ftp):\/\/)/) ? '' : 'http://'}${
          host.name
        }`,
      }));
      this.users = response['users'];
      this.creds = response['credentials'];
      this.clients = response['clients'];
      this.nmap = response.nmap;
      this.nessus = response.nessus;

      this.id = response.id;

      // let toto =  Object.entries(response).map(([k, v]) => this[k] = v);
    });
  }

  addCodiMd(form: NgForm): void {
    this.missionsService.update(this.id, form.value).subscribe(
      (el) => {
        console.log('RETOUR UPDATED', el);
        this.openSnackBar('codiMD updated');
        this.ngOnInit();
      },
      (err) => {
        if (err.status == '400') {
          this.openSnackBar('Error : ' + err.error['hydra:description']);
        }
      }
    );
  }

  addHost(form: NgForm): void {
    Object.assign(form.value, { checked: false });
    Object.assign(form.value, { mission: this.mission['@id'] });
    this.hostsService.insert(form.value).subscribe(
      (el) => {
        this.ngOnInit();
      },
      (err) => {
        if (err.status == '400') {
          this.openSnackBar('Error : ' + err.error['hydra:description']);
        }
      }
    );
  }

  editMission(): void {
    // console.log("on passe ici", this.id);
    this.router.navigateByUrl(`/missions/details/${this.id}`);
  }

  sendFile(): void {
    const fd = new FormData();
    fd.append('filename', this.file);
    fd.append('missionName', this.mission.name);
    this.uploadServices.uploadHosts(fd).then(
      () => this.router.navigateByUrl(`/missions/details/${this.id}`),
      () =>
        this.openSnackBar(
          'one or many host in ure file already exist in database and probably used by other mission'
        )
    );
  }

  onSelectFile(event): void {
    this.file = event.target.files[0];
  }

  selectFile(): void {
    this.fileInput.nativeElement.click();
  }

  goToAddVulns(uri, mission_id): void {
    const id = uri.split('/').pop();
    this.router.navigateByUrl(`/missions/${id}/add-vuln/${mission_id}`);
  }

  applyFilter(filterValue: string) {
    filterValue = filterValue.trim();
    filterValue = filterValue.toLowerCase();
  }

  generate(): void {
    loadFile(`/assets/Smersh.docx`, (error, content) => {
      if (error) {
        throw error;
      }

      const zip = new PizZip(content);
      const doc = new Docxtemplater().loadZip(zip);
      const locale = new Locale().get();
      const hosts = this.hosts.map((host) => ({
        ...host,
        vulns: host.vulns.map((vuln) => ({
          ...vuln.translations[locale],
          vulnName: vuln.translations[locale].name,
        })),
      }));
      doc.setData({
        startDate: this.mission.startDate,
        CLIENT_NAME: this.missionName,
        creds: this.mission.credentials
          ? this.mission.credentials
          : 'No Account used',
        classification: 'Confidentiel client - C3 ',
        phone: '00-00-00-00',
        version: '1.0',
        by: 'jenaye@protonmail.com',
        to: 'myclient@localhost.com',
        authors: this.users,
        state: 'draft',
        scope: hosts,
      });

      try {
        // render the document (replace all occurences of key by your data)
        doc.render();
      } catch (error) {
        if (error.properties && error.properties.errors instanceof Array) {
          console.log(
            'errorMessages',
            error.properties.errors
              .map((e) => e.properties.explanation)
              .join('\n')
          );
        }
        throw error;
      }
      const out = doc.getZip().generate({
        type: 'blob',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }); // Output the document using Data-URI
      saveAs(out, 'rapport.docx');
    });
  }

  share(): void {
    window.alert('The product has been shared!');
  }
}
