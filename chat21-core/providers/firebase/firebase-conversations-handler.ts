import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// firebase
import * as firebase from 'firebase/app';
import 'firebase/messaging';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/storage';

// models
import { ConversationModel } from '../../models/conversation';

// services
import { ConversationsHandlerService } from '../abstract/conversations-handler.service';
import { AppConfigService } from './../../../app/providers/app-config.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LoggerService } from '../abstract/logger.service';
import { LoggerInstance } from '../logger/loggerInstance';

// utils
import { avatarPlaceholder, getColorBck } from '../../utils/utils-user';
import { compareValues, getFromNow, conversationsPathForUserId, searchIndexInArrayForUid, isGroup } from '../../utils/utils';




// @Injectable({ providedIn: 'root' })
@Injectable()
export class FirebaseConversationsHandler extends ConversationsHandlerService {

    // BehaviorSubject
    BSConversationDetail: BehaviorSubject<ConversationModel>;
    conversationAdded: BehaviorSubject<ConversationModel>;
    conversationChanged: BehaviorSubject<ConversationModel>;
    conversationRemoved: BehaviorSubject<ConversationModel>;
    loadedConversationsStorage: BehaviorSubject<ConversationModel[]>;
    // readAllMessages: BehaviorSubject<string>;

    // public params
    conversations: Array<ConversationModel> = [];
    uidConvSelected: string;
    tenant: string;
    // imageRepo: ImageRepoService = new FirebaseImageRepoService();

    // private params
    private loggedUserId: string;
    private translationMap: Map<string, string>;
    private isConversationClosingMap: Map<string, boolean>;
    private logger:LoggerService = LoggerInstance.getInstance()
    private ref: firebase.database.Query;
    private BASE_URL: string;
    private BASE_URL_DATABASE: string;
    // private audio: any;
    // private setTimeoutSound: any;
    private subscribe: any

    constructor(
        public http: HttpClient,
        public appConfig: AppConfigService
    ) {
        super();
    }

    /**
     * inizializzo conversations handler
     */
    initialize(
        tenant: string,
        userId: string,
        translationMap: Map<string, string>
    ) {
        this.tenant = tenant;
        this.loggedUserId = userId;
        this.translationMap = translationMap;
        this.conversations = [];
        this.isConversationClosingMap = new Map();
        //this.databaseProvider.initialize(userId, this.tenant);
        //this.getConversationsFromStorage();
        this.BASE_URL = this.appConfig.getConfig().firebaseConfig.chat21ApiUrl;
        this.BASE_URL_DATABASE = this.appConfig.getConfig().firebaseConfig.databaseURL;
    }

    /**
     * mi connetto al nodo conversations
     * creo la reference
     * mi sottoscrivo a change, removed, added
     */
    // connect() {
    //     const that = this;
    //     const urlNodeFirebase = conversationsPathForUserId(this.tenant, this.loggedUserId);
    //     this.logger.debug('connect -------> conversations::ACTIVE', urlNodeFirebase)
    //     this.ref = firebase.database().ref(urlNodeFirebase).orderByChild('timestamp').limitToLast(200);
    //     this.ref.on('child_changed', (childSnapshot) => {
    //         that.changed(childSnapshot);
    //     });
    //     this.ref.on('child_removed', (childSnapshot) => {
    //         that.removed(childSnapshot);
    //     });
    //     this.ref.on('child_added', (childSnapshot) => {
    //         that.added(childSnapshot);
    //     });
    //     // SET AUDIO
    //     // this.audio = new Audio();
    //     // this.audio.src = URL_SOUND;
    //     // this.audio.load();

    // }

    /**
     * mi connetto al nodo conversations
     * creo la reference
     * mi sottoscrivo a change, removed, added
     */
    // ---------------------------------------------------------------------------------
    // New connect - renamed subscribeToConversation
    //----------------------------------------------------------------------------------
    subscribeToConversations(callback) {
        const that = this;
        const urlNodeFirebase = conversationsPathForUserId(this.tenant, this.loggedUserId);
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE] SubscribeToConversations conversations::ACTIVE urlNodeFirebase', urlNodeFirebase)
        this.ref = firebase.database().ref(urlNodeFirebase).orderByChild('timestamp').limitToLast(200);
        this.ref.on('child_changed', (childSnapshot) => {
            that.changed(childSnapshot);
        });
        this.ref.on('child_removed', (childSnapshot) => {
            that.removed(childSnapshot);
        });
        this.ref.on('child_added', (childSnapshot) => {
            that.added(childSnapshot);
        });

        setTimeout(() => {
            callback()
        }, 2000);
        // SET AUDIO
        // this.audio = new Audio();
        // this.audio.src = URL_SOUND;
        // this.audio.load();
    }

    public getLastConversation(callback: (conversation: ConversationModel, error: string)=>void){

        this.getFirebaseToken((error, idToken) => {
            this.logger.debug('[FIREBASEConversationsHandlerSERVICE] getConversationsRESTApi  idToken', idToken)
            this.logger.debug('[FIREBASEConversationsHandlerSERVICE] getConversationsRESTApi  error', error)
            if (idToken) {
                const httpOptions = {
                    headers: new HttpHeaders({
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        // 'Authorization': 'Bearer ' + idToken,
                    })

                }
                const urlNodeFirebase = conversationsPathForUserId(this.tenant, this.loggedUserId);
                const queryString = '?auth=' + idToken +'&orderBy="timestamp"&limitToLast=1'
                const url = this.BASE_URL_DATABASE + urlNodeFirebase + '.json' + queryString// + queryString;
                this.http.get(url, httpOptions).subscribe((childSnapshot: any) => {
                    this.logger.debug('[FIREBASEConversationsHandlerSERVICE] getConversationsRESTApi - RES', childSnapshot);
                    if(childSnapshot){
                        const childData: ConversationModel = childSnapshot[Object.keys(childSnapshot)[0]];
                        childData.uid = Object.keys(childSnapshot)[0]
                        const conversation = this.completeConversation(childData); 
                        callback(conversation, null)
                    }else if(!childSnapshot){
                        callback(null, null)
                    }
                }, (error) => {
                    this.logger.error('[FIREBASEConversationsHandlerSERVICE] getConversationsRESTApi ERROR ', error);
                    callback(null, 'error')
                }, () => {
                    this.logger.debug('[FIREBASEConversationsHandlerSERVICE] getConversationsRESTApi * COMPLETE *');
                });
            } else {
                callback(null, 'error')
            }
        });
    }

    /**
     * restituisce il numero di conversazioni nuove
     */
    countIsNew(): number {
        let num = 0;
        this.conversations.forEach((element) => {
            if (element.is_new === true) {
                num++;
            }
        });
        return num;
    }


    setConversationRead(conversationrecipient): void {
        const urlUpdate = conversationsPathForUserId(this.tenant, this.loggedUserId) + '/' + conversationrecipient;
        const update = {};
        update['/is_new'] = false;
        firebase.database().ref(urlUpdate).update(update);
    }

    /**
     * Returns the status of the conversations with conversationId from isConversationClosingMap
     * @param conversationId the conversation id
     * @returns true if the conversation is waiting to be closed, false otherwise
     */
    getClosingConversation(conversationId: string) {
        return this.isConversationClosingMap[conversationId];
    }

    /**
     * Add the conversation with conversationId to the isConversationClosingMap
     * @param conversationId the id of the conversation of which it wants to save the state
     * @param status true if the conversation is waiting to be closed, false otherwise
     */
    setClosingConversation(conversationId: string, status: boolean) {
        this.isConversationClosingMap[conversationId] = status;
    }

    /**
     * Delete the conversation with conversationId from the isConversationClosingMap
     * @param conversationId the id of the conversation of which is wants to delete
     */
    deleteClosingConversation(conversationId: string) {
        this.isConversationClosingMap.delete(conversationId);
    }

    // -------->>>> ARCHIVE CONVERSATION SECTION START <<<<---------------//
    archiveConversation(conversationId: string) {
        const that = this
        this.setClosingConversation(conversationId, true);
        const index = searchIndexInArrayForUid(this.conversations, conversationId);
        // if (index > -1) {
        //     this.conversations.splice(index, 1);
        // fare chiamata delete per rimuoverle la conversazione da remoto
        this.deleteConversation(conversationId, function (response) {
            that.logger.debug('[FIREBASEConversationsHandlerSERVICE]  ARCHIVE-CONV', response)
            if (response === 'success') {
                if (index > -1) {
                    that.conversations.splice(index, 1);
                }
            } else if (response === 'error') {
                that.setClosingConversation(conversationId, false);
            }

        })
        // }
    }

    deleteConversation(conversationId, callback) {
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DELETE CONV conversationId', conversationId)
        // let queryString = ''
        // let isSupportConversation = conversationId.startsWith("support-group");
        // if (isSupportConversation) {
        //     queryString = '?forall=true'
        // }

        this.getFirebaseToken((error, idToken) => {
            this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DELETE CONV idToken', idToken)
            this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DELETE CONV error', error)
            if (idToken) {
                const httpOptions = {
                    headers: new HttpHeaders({
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + idToken,
                    })
                }
                const url = this.BASE_URL + '/api/' + this.tenant + '/conversations/' + conversationId // + queryString;
                this.http.delete(url, httpOptions).subscribe(res => {
                    this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DELETE CONV - RES', res);
                    callback('success')
                }, (error) => {
                    this.logger.error('[FIREBASEConversationsHandlerSERVICE] DELETE CONV ERROR ', error);
                    callback('error')
                }, () => {
                    this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DELETE CONV * COMPLETE *');

                });
            } else {
                callback('error')
            }
        });
    }


    getFirebaseToken(callback:(error: any, idToken: string)=>void) {
        const firebase_currentUser = firebase.auth().currentUser;
        this.logger.debug(' // firebase current user ', firebase_currentUser);
        if (firebase_currentUser) {
            firebase_currentUser.getIdToken(/* forceRefresh */ true)
                .then(function (idToken) {
                    // qui richiama la callback
                    callback(null, idToken);
                }).catch(function (error) {
                    // Handle error
                    callback(error, null);
                });
        }
    }
    // -------->>>> ARCHIVE CONVERSATION SECTION END <<<<---------------//


    public getConversationDetail(conversationId: string, callback: (conv: ConversationModel) => void): void {
        // fare promise o callback ??
        const conversation = this.conversations.find(item => item.uid === conversationId);
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE]  conversations *****: ', this.conversations)
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE]  getConversationDetail *****: ', conversation)
        if (conversation) {
            callback(conversation)
            // return conversationSelected
            // this.BSConversationDetail.next(conversationSelected);
        } else {
            // const urlNodeFirebase = '/apps/' + this.tenant + '/users/' + this.loggedUserId + '/conversations/' + conversationId;
            const urlNodeFirebase = conversationsPathForUserId(this.tenant, this.loggedUserId) // + '/' + conversationId;
            this.logger.debug('[FIREBASEConversationsHandlerSERVICE] conversationDetail urlNodeFirebase *****', urlNodeFirebase)
            const firebaseMessages = firebase.database().ref(urlNodeFirebase);
            if(this.subscribe){
                this.logger.log('[FIREBASEConversationsHandlerSERVICE] getConversationDetail ALREADY SUBSCRIBED')
                return;
            }
            
            this.subscribe = firebaseMessages.on('value', (snap) => {
                const childSnapshot = snap.child('/'+conversationId)
                if(!childSnapshot.exists()){
                    this.logger.log('[FIREBASEConversationsHandlerSERVICE] getConversationDetail conversation NOT exist', conversationId)
                    callback(null)
                } else {
                    const childData: ConversationModel = childSnapshot.val();
                    this.logger.debug('[FIREBASEConversationsHandlerSERVICE] getConversationDetail conversation exist', childSnapshot.val(), childSnapshot.key)
                    if (childSnapshot && childSnapshot.key && childData) {
                        childData.uid = childSnapshot.key;
                        const conversation = this.completeConversation(childData);
                        if (conversation) {
                            callback(conversation)
                        } else {
                            callback(null)
                        }
                    }
                    // this.BSConversationDetail.next(conversation);
                }
                // const childData: ConversationModel = childSnapshot.val();
                // this.logger.debug('[FIREBASEConversationsHandlerSERVICE] conversationDetail childSnapshot *****', childSnapshot.val())
                // if (childSnapshot && childSnapshot.key && childData) {
                //     childData.uid = childSnapshot.key;
                //     const conversation = this.completeConversation(childData);
                //     if (conversation) {
                //         callback(conversation)
                //     } else {
                //         callback(null)
                //     }
                // }
                // this.BSConversationDetail.next(conversation);
            });
        }

    }
    /**
     * dispose reference di conversations
     */
    dispose() {
        this.conversations = [];
        this.uidConvSelected = '';
        //this.ref.off();
        // this.ref.off("child_changed");
        // this.ref.off("child_removed");
        // this.ref.off("child_added");
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE] DISPOSE::: ', this.ref)
    }


    // ---------------------------------------------------------- //
    // BEGIN PRIVATE FUNCTIONS
    // ---------------------------------------------------------- //
    /**
     *
     */
    // private getConversationsFromStorage() {
    //     const that = this;
    //     this.databaseProvider.getConversations()
    //     .then((conversations: [ConversationModel]) => {
    //         that.loadedConversationsStorage.next(conversations);
    //     })
    //     .catch((e) => {
    //         this.logger.error('error: ', e);
    //     });
    // }


    // /** 
    //  *
    //  * @param childSnapshot
    //  */
    private conversationGenerate(childSnapshot: any): boolean {
        const childData: ConversationModel = childSnapshot.val();
        childData.uid = childSnapshot.key;
        const conversation = this.completeConversation(childData);
        if (this.isValidConversation(conversation)) {
            this.setClosingConversation(childSnapshot.key, false);
            const index = searchIndexInArrayForUid(this.conversations, conversation.uid);
            if (index > -1) {
                this.conversations.splice(index, 1, conversation);
            } else {
                this.conversations.splice(0, 0, conversation);
            }
            //this.databaseProvider.setConversation(conversation);
            this.conversations.sort(compareValues('timestamp', 'desc'));
            return true;
        } else {
            return false;
        }
    }
    /**
    *
    * @param childSnapshot
    */
    // private conversationGenerate(childSnapshot: any): ConversationModel {
    //     this.logger.debug('conversationGenerate: ', childSnapshot.val());
    //     const childData: ConversationModel = childSnapshot.val();
    //     childData.uid = childSnapshot.key;
    //     const conversation = this.completeConversation(childData);
    //     if (this.isValidConversation(conversation)) {
    //         this.setClosingConversation(childSnapshot.key, false);
    //         const index = searchIndexInArrayForUid(this.conversations, conversation.uid);
    //         if (index > -1) {
    //             this.conversations.splice(index, 1, conversation);
    //         } else {
    //             this.conversations.splice(0, 0, conversation);
    //         }
    //         //this.databaseProvider.setConversation(conversation);
    //         this.conversations.sort(compareValues('timestamp', 'desc'));
    //         if (conversation.is_new) {
    //             this.soundMessage();
    //         }
    //         return conversation;
    //     } else {
    //         return null;
    //     }
    // }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    /**
     * 1 -  completo la conversazione con i parametri mancanti
     * 2 -  verifico che sia una conversazione valida
     * 3 -  salvo stato conversazione (false) nell'array delle conversazioni chiuse
     * 4 -  aggiungo alla pos 0 la nuova conversazione all'array di conversazioni 
     *      o sostituisco la conversazione con quella preesistente
     * 5 -  salvo la conversazione nello storage
     * 6 -  ordino l'array per timestamp
     * 7 -  pubblico conversations:update
     */
    //TODO-GAB: ora emit singola conversation e non dell'intero array di conversations
    private added(childSnapshot: any) {
        if (this.conversationGenerate(childSnapshot)) {
            const index = searchIndexInArrayForUid(this.conversations, childSnapshot.key);
            if (index > -1) {
                const conversationAdded = this.conversations[index]
                this.conversationAdded.next(conversationAdded);
            }
        } else {
            this.logger.error('[FIREBASEConversationsHandlerSERVICE]ADDED::conversations with conversationId: ', childSnapshot.key, 'is not valid')
        }
    }

    /**
     * 1 -  completo la conversazione con i parametri mancanti
     * 2 -  verifico che sia una conversazione valida
     * 3 -  aggiungo alla pos 0 la nuova conversazione all'array di conversazioni 
     * 4 -  salvo la conversazione nello storage
     * 5 -  ordino l'array per timestamp
     * 6 -  pubblico conversations:update
     * 7 -  attivo sound se è un msg nuovo
     */

    //TODO-GAB: ora emit singola conversation e non dell'intero array di conversations
    private changed(childSnapshot: any) {
        if (this.conversationGenerate(childSnapshot)) {
            const index = searchIndexInArrayForUid(this.conversations, childSnapshot.key);
            if (index > -1) {
                const conversationChanged = this.conversations[index]
                this.conversationChanged.next(conversationChanged);
            }
        } else {
            this.logger.error('[FIREBASEConversationsHandlerSERVICE]CHANGED::conversations with conversationId: ', childSnapshot.key, 'is not valid')
        }
    }

    /**
     * 1 -  cerco indice conversazione da eliminare
     * 2 -  elimino conversazione da array conversations
     * 3 -  elimino la conversazione dallo storage
     * 4 -  pubblico conversations:update
     * 5 -  elimino conversazione dall'array delle conversazioni chiuse
     */
    //TODO-GAB: ora emit singola conversation e non dell'intero array di conversations
    private removed(childSnapshot: any) {
        const index = searchIndexInArrayForUid(this.conversations, childSnapshot.key);
        if (index > -1) {
            const conversationRemoved = this.conversations[index]
            this.conversations.splice(index, 1);
            // this.conversations.sort(compareValues('timestamp', 'desc'));
            //this.databaseProvider.removeConversation(childSnapshot.key);
            this.conversationRemoved.next(conversationRemoved);
        }
        // remove the conversation from the isConversationClosingMap
        this.deleteClosingConversation(childSnapshot.key);
    }


    /**
     * Completo conversazione aggiungendo:
     * 1 -  nel caso in cui sender_fullname e recipient_fullname sono vuoti, imposto i rispettivi id come fullname,
     *      in modo da avere sempre il campo fullname popolato
     * 2 -  imposto conversation_with e conversation_with_fullname con i valori del sender o al recipient,
     *      a seconda che il sender corrisponda o meno all'utente loggato. Aggiungo 'tu:' se il sender coincide con il loggedUser
     *      Se il sender NON è l'utente loggato, ma è una conversazione di tipo GROUP, il conversation_with_fullname
     *      sarà uguale al recipient_fullname
     * 3 -  imposto stato conversazione, che indica se ci sono messaggi non letti nella conversazione
     * 4 -  imposto il tempo trascorso tra l'ora attuale e l'invio dell'ultimo messaggio
     * 5 -  imposto avatar, colore e immagine
     * @param conv
     */
    private completeConversation(conv): ConversationModel {
        this.logger.debug('[FIREBASEConversationsHandlerSERVICE] completeConversation --> conv from firebase', conv)
        conv.selected = false;
        if (!conv.sender_fullname || conv.sender_fullname === 'undefined' || conv.sender_fullname.trim() === '') {
            conv.sender_fullname = conv.sender;
        }
        if (!conv.recipient_fullname || conv.recipient_fullname === 'undefined' || conv.recipient_fullname.trim() === '') {
            conv.recipient_fullname = conv.recipient;
        }
        let conversation_with_fullname = conv.sender_fullname;
        let conversation_with = conv.sender;
        if (conv.sender === this.loggedUserId) {
            conversation_with = conv.recipient;
            conversation_with_fullname = conv.recipient_fullname;
            conv.sender_fullname = this.translationMap.get('YOU')
            // conv.last_message_text = YOU + conv.last_message_text;
        // } else if (conv.channel_type === TYPE_GROUP) {
        } else if (isGroup(conv)) {
            // conversation_with_fullname = conv.sender_fullname;
            // conv.last_message_text = conv.last_message_text;
            conversation_with = conv.recipient;
            conversation_with_fullname = conv.recipient_fullname;
        }
        // Fixes the bug: if a snippet of code is pasted and sent it is not displayed correctly in the convesations list
        // conv.time_last_message = this.getTimeLastMessage(conv.timestamp);
        conv.conversation_with = conversation_with;
        conv.conversation_with_fullname = conversation_with_fullname;
        conv.status = this.setStatusConversation(conv.sender, conv.uid);
        conv.avatar = avatarPlaceholder(conversation_with_fullname);
        conv.color = getColorBck(conversation_with_fullname);
        //conv.image = this.imageRepo.getImagePhotoUrl(conversation_with);
        // getImageUrlThumbFromFirebasestorage(conversation_with, this.FIREBASESTORAGE_BASE_URL_IMAGE, this.urlStorageBucket);
        return conv;
    }

    /** */
    private setStatusConversation(sender: string, uid: string): string {
        let status = '0'; // letto
        if (sender === this.loggedUserId || uid === this.uidConvSelected) {
            status = '0';
        } else {
            status = '1'; // non letto
        }
        return status;
    }

    /**
     * calcolo il tempo trascorso da ora al timestamp passato
     * @param timestamp
     */
    private getTimeLastMessage(timestamp: string) {
        const timestampNumber = parseInt(timestamp, 10) / 1000;
        const time = getFromNow(timestampNumber);
        return time;
    }

    /**
     *  check if the conversations is valid or not
     */
    private isValidConversation(convToCheck: ConversationModel): boolean {

        if (!this.isValidField(convToCheck.uid)) {
            return false;
        }
        if (!this.isValidField(convToCheck.is_new)) {
            return false;
        }
        if (!this.isValidField(convToCheck.last_message_text)) {
            return false;
        }
        if (!this.isValidField(convToCheck.recipient)) {
            return false;
        }
        if (!this.isValidField(convToCheck.recipient_fullname)) {
            return false;
        }
        if (!this.isValidField(convToCheck.sender)) {
            return false;
        }
        if (!this.isValidField(convToCheck.sender_fullname)) {
            return false;
        }
        if (!this.isValidField(convToCheck.status)) {
            return false;
        }
        if (!this.isValidField(convToCheck.timestamp)) {
            return false;
        }
        if (!this.isValidField(convToCheck.channel_type)) {
            return false;
        }
        return true;
    }

    /**
     *
     * @param field
     */
    private isValidField(field: any): boolean {
        return (field === null || field === undefined) ? false : true;
    }

    // ---------------------------------------------------------- //
    // END PRIVATE FUNCTIONS
    // ---------------------------------------------------------- //
}

