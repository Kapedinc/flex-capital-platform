import { GroupsHandlerService } from '../abstract/groups-handler.service';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

// firebase
import * as firebase from 'firebase/app';
import 'firebase/messaging';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/storage';

// models
import { ConversationModel } from '../../models/conversation';
import { GroupModel } from '../../models/group';

// services
import { AppConfigService } from '../../../app/providers/app-config.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LoggerService } from '../abstract/logger.service';
import { LoggerInstance } from '../logger/loggerInstance';

// utils
import { avatarPlaceholder, getColorBck } from '../../utils/utils-user';

// @Injectable({ providedIn: 'root' })
@Injectable()
export class FirebaseGroupsHandler extends GroupsHandlerService {

    // BehaviorSubject
    BSgroupDetail: BehaviorSubject<GroupModel>;
    SgroupDetail: Subject<GroupModel>;
    groupAdded: BehaviorSubject<GroupModel>;
    groupChanged: BehaviorSubject<GroupModel>;
    groupRemoved: BehaviorSubject<GroupModel>;

    // public params
    conversations: Array<ConversationModel> = [];
    uidConvSelected: string;

    // private params
    private tenant: string;
    private loggedUserId: string;
    private ref: firebase.database.Query;
    private BASE_URL: string;
    private logger:LoggerService = LoggerInstance.getInstance()

    // private audio: any;
    // private setTimeoutSound: any;

    constructor(
        public http: HttpClient,
        public appConfig: AppConfigService
    ) {
        super();
    }

    /**
     * inizializzo groups handler
     */
    initialize(tenant: string, loggedUserId: string) {
        this.tenant = tenant;
        this.loggedUserId = loggedUserId;
        this.BASE_URL = this.appConfig.getConfig().firebaseConfig.chat21ApiUrl;
        this.logger.debug('[FIREBASEGroupHandlerSERVICE] initialize', this.tenant, this.loggedUserId);
    }

    /**
     * mi connetto al nodo groups
     * creo la reference
     * mi sottoscrivo a change, removed, added
     */
    connect() {
        //********* NOT IN USE ********** */
        const that = this;
        const urlNodeGroups = '/apps/' + this.tenant + '/users/' + this.loggedUserId + '/groups';
        this.logger.debug('[FIREBASEGroupHandlerSERVICE] connect -------> groups::', urlNodeGroups)
        this.ref = firebase.database().ref(urlNodeGroups)
        this.ref.on('child_added', (childSnapshot) => {
            that.logger.debug('[FIREBASEGroupHandlerSERVICE]  child_added ------->', childSnapshot.val())
            // that.added(childSnapshot);
        });
        this.ref.on('child_changed', (childSnapshot) => {
            that.logger.debug('[FIREBASEGroupHandlerSERVICE]  child_changed ------->', childSnapshot.val())
            // that.changed(childSnapshot);
        });
        this.ref.on('child_removed', (childSnapshot) => {
            that.logger.debug('[FIREBASEGroupHandlerSERVICE]  child_removed ------->', childSnapshot.val())
            // that.removed(childSnapshot);
        });
    }

    /**
     * mi connetto al nodo groups/GROUPID
     * creo la reference
     * mi sottoscrivo a value
     */
    getDetail(groupId: string, callback?: (group: GroupModel)=>void): Promise<GroupModel>{
        const urlNodeGroupById = '/apps/' + this.tenant + '/users/' + this.loggedUserId + '/groups/' + groupId;
        this.logger.debug('[FIREBASEGroupHandlerSERVICE] getDetail -------> urlNodeGroupById::', urlNodeGroupById)
        const ref = firebase.database().ref(urlNodeGroupById)
        return new Promise((resolve) => {
            ref.off()
            ref.on('value', (childSnapshot) => {
                const group: GroupModel = childSnapshot.val();
                group.uid = childSnapshot.key
                // that.BSgroupDetail.next(group)
                if (callback) {
                    callback(group)
                }
                resolve(group)
            });
        });

    }

    onGroupChange(groupId: string): Observable<GroupModel> {
        const that = this;
        let SgroupDetail = new Subject<GroupModel>();
        const urlNodeGroupById = '/apps/' + this.tenant + '/users/' + this.loggedUserId + '/groups/' + groupId;
        this.logger.log('[FIREBASEGroupHandlerSERVICE] onGroupChange -------> urlNodeGroupById::', urlNodeGroupById)
        const ref = firebase.database().ref(urlNodeGroupById)
        ref.off()
        ref.on('value', (childSnapshot) => {
            // this.groupValue(childSnapshot)
            if(childSnapshot.val() ) {
                const group: GroupModel = childSnapshot.val();
                if (group) {
                    group.uid = childSnapshot.key
                    // that.BSgroupDetail.next(group)
                    let groupCompleted = this.completeGroup(group)
                    // this.SgroupDetail.next(groupCompleted) 
                    SgroupDetail.next(groupCompleted) 
                } 
            }
        });
        // return this.SgroupDetail
        return SgroupDetail
    }

    // private groupValue(childSnapshot: any){
    //     const that = this;
    //     let SgroupDetail = new Subject<GroupModel>();
    //     this.logger.debug('[FIREBASEGroupHandlerSERVICE] group detail::', childSnapshot.val(), childSnapshot)
    //     const group: GroupModel = childSnapshot.val();
    //     this.logger.debug('[FIREBASEGroupHandlerSERVICE]  groupValue ', group)
    //     if (group) {
    //         group.uid = childSnapshot.key
    //         // that.BSgroupDetail.next(group)
    //         let groupCompleted = this.completeGroup(group)
    //         // this.SgroupDetail.next(groupCompleted) 
    //         SgroupDetail.next(groupCompleted) 
    //     } 
    // }

    create(groupName: string, members: [string], callback?: (res: any, error: any) => void): Promise<any> {
        var that = this;
        let listMembers = {};
        members.forEach(member => {
            listMembers[member] = 1
        });

        return new Promise((resolve, reject) =>{
            this.getFirebaseToken((error, idToken) => {
                that.logger.debug('[FIREBASEGroupHandlerSERVICE] CREATE GROUP idToken', idToken, error)
                if (idToken) {
                    const httpOptions = {
                        headers: new HttpHeaders({
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + idToken,
                        })
                    }
                    const body = {
                        "group_name": groupName,
                        "group_members": listMembers
                    }
                    const url = that.BASE_URL + '/api/' + that.tenant + '/groups'
                    that.http.post(url, body, httpOptions).toPromise().then((res) => {
                        callback(res, null);
                        resolve(res)
                    }).catch(function (error) {
                        // Handle error
                        that.logger.error('[FIREBASEGroupHandlerSERVICE] createGROUP error: ', error);
                        callback(null, error);
                        reject(error);
                    });
                }else{
                    callback(null, error)
                    reject(error)
                }
            });
        });
    }

    join(groupId: string, member: string, callback?: (res: any, error: any) => void) {
        var that = this;
        return new Promise((resolve, reject) =>{
            this.getFirebaseToken((error, idToken) => {
                that.logger.debug('[FIREBASEGroupHandlerSERVICE] JOIN GROUP idToken', idToken, error)
                if (idToken) {
                    const httpOptions = {
                        headers: new HttpHeaders({
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + idToken,
                        })
                    }
                    const body = {
                        "member_id": member
                    }
                    const url = that.BASE_URL + '/api/' + that.tenant + '/groups/' + groupId + '/members'
                    that.http.post(url, body, httpOptions).toPromise().then((res) => {
                        callback(res, null);
                        resolve(res)
                    }).catch(function (error) {
                        // Handle error
                        that.logger.error('[FIREBASEGroupHandlerSERVICE] createGROUP error: ', error);
                        callback(null, error);
                        reject(error);
                    });
                }else{
                    callback(null, error)
                    reject(error)
                }
            });
        });
    }

    leave(groupId: string, callback?: (res: any, error: any) => void): Promise<any> {
        var that = this;
        return new Promise((resolve, reject) =>{
            this.getFirebaseToken((error, idToken) => {
                that.logger.debug('[FIREBASEGroupHandlerSERVICE] LEAVE CONV idToken', idToken, error)
                if (idToken) {
                    const httpOptions = {
                        headers: new HttpHeaders({
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + idToken,
                        })
                    }
                    const url = that.BASE_URL + '/api/' + that.tenant + '/groups/' + groupId + '/members/' + that.loggedUserId
                    that.http.delete(url, httpOptions).toPromise().then((res) => {
                        callback(res, null);
                        resolve(res)
                    }).catch(function (error) {
                        // Handle error
                        that.logger.error('[FIREBASEGroupHandlerSERVICE] LEAVE idToken error: ', error);
                        callback(null, error);
                        reject(error);
                    });
                }else{
                    callback(null, error)
                    reject(error)
                }
            });
        });
    }


    dispose() {
        this.conversations = [];
        this.uidConvSelected = '';
        this.ref.off();
        // this.ref.off("child_changed");
        // this.ref.off("child_removed");
        // this.ref.off("child_added");
        this.logger.debug('[FIREBASEGroupHandlerSERVICE] DISPOSE', this.ref)
    }

    // // -------->>>> PRIVATE METHOD SECTION START <<<<---------------//
    private getFirebaseToken(callback) {
        const firebase_currentUser = firebase.auth().currentUser;
        this.logger.debug('[FIREBASEGroupHandlerSERVICE]  // firebase current user ', firebase_currentUser);
        if (firebase_currentUser) {
            const that = this;
            firebase_currentUser.getIdToken(/* forceRefresh */ true)
                .then(function (idToken) {
                    // qui richiama la callback
                    callback(null, idToken);
                }).catch(function (error) {
                    // Handle error
                    that.logger.error('[FIREBASEGroupHandlerSERVICE] ERROR -> idToken.', error);
                    callback(error, null);
                });
        }
    }

    private completeGroup(group: any): GroupModel{
        group.avatar = avatarPlaceholder(group.name);
        group.color = getColorBck(group.name);
        return group 
    }
    // // -------->>>> PRIVATE METHOD SECTION SECTION END <<<<---------------//
}
