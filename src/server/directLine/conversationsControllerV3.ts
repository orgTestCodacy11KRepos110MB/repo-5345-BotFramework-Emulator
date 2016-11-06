import * as Restify from 'restify';
import * as HttpStatus from "http-status-codes";
import { emulator } from '../emulator';
import { getSettings } from '../settings';
import { uniqueId } from '../../utils';
import { IGenericActivity } from '../../types/activityTypes';
import { IAttachment } from '../../types/attachmentTypes';
import { Conversation } from '../conversationManager';
import * as log from '../log';


export class ConversationsControllerV3 {

    static registerRoutes(server: Restify.Server) {
        server.opts('/v3/directline', ConversationsControllerV3.options);
        server.post('/v3/directline/conversations', ConversationsControllerV3.startConversation);
        server.get('/v3/directline/conversations/:conversationId', ConversationsControllerV3.reconnectToConversation);
        server.get('/v3/directline/conversations/:conversationId/activities/', ConversationsControllerV3.getActivities);
        server.post('/v3/directline/conversations/:conversationId/activities', ConversationsControllerV3.postActivity);
        server.post('/v3/directline/conversations/:conversationId/upload', ConversationsControllerV3.upload);
        server.get('/v3/directline/conversations/:conversationId/stream', ConversationsControllerV3.stream);
    }

    static options(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        res.send(HttpStatus.OK);
        res.end();
    }

    static startConversation(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        const activeBot = getSettings().getActiveBot();
        if (activeBot) {
            let created = false;
            const auth = req.header('Authorization');
            const tokenMatch = /Bearer\s+(.+)/.exec(auth);
            let conversation = emulator.conversations.conversationById(activeBot.botId, tokenMatch[1]);
            if (!conversation) {
                const users = getSettings().users;
                const currentUser = users.usersById[users.currentUserId];
                conversation = emulator.conversations.newConversation(activeBot.botId, currentUser);
                conversation.sendBotAddedToConversation();
                created = true;
            }
            res.json(created ? HttpStatus.CREATED : HttpStatus.OK, {
                conversationId: conversation.conversationId,
                token: conversation.conversationId,
                expires_in: Number.MAX_VALUE,
                streamUrl: ''
            });
        } else {
            res.send(HttpStatus.NOT_FOUND, "no active bot");
            log.error("DirectLine: Cannot start conversation. No active bot");
        }
        res.end();
    }

    static reconnectToConversation(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        const activeBot = getSettings().getActiveBot();
        if (activeBot) {
            const conversation = emulator.conversations.conversationById(activeBot.botId, req.params.conversationId);
            if (conversation) {
                res.json(HttpStatus.OK, {
                    conversationId: conversation.conversationId,
                    token: conversation.conversationId,
                    expires_in: Number.MAX_VALUE,
                    streamUrl: ''
                });
            } else {
                res.send(HttpStatus.NOT_FOUND, "conversation not found");
                log.error("DirectLine: Cannot post activity. Conversation not found");
            }
        } else {
            res.send(HttpStatus.NOT_FOUND, "no active bot");
            log.error("DirectLine: Cannot start conversation. No active bot");
        }
        res.end();
    }

    static getActivities(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        const activeBot = getSettings().getActiveBot();
        if (activeBot) {
            const conversation = emulator.conversations.conversationById(activeBot.botId, req.params.conversationId);
            if (conversation) {
                const watermark = Number(req.params.watermark || 0) || 0;
                const activities = conversation.getActivitiesSince(req.params.watermark);
                res.json(HttpStatus.OK, {
                    activities,
                    watermark: watermark + activities.length
                });
            } else {
                res.send(HttpStatus.NOT_FOUND, "conversation not found");
                log.error("DirectLine: Cannot get activities. Conversation not found");
            }
        } else {
            res.send(HttpStatus.NOT_FOUND, "no active bot");
            log.error("DirectLine: Cannot get activities. No active bot");
        }
        res.end();
    }

    static postActivity(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        const activeBot = getSettings().getActiveBot();
        if (activeBot) {
            const conversation = emulator.conversations.conversationById(activeBot.botId, req.params.conversationId);
            if (conversation) {
                const activity = <IGenericActivity>req.body;
                activity.serviceUrl = emulator.framework.serviceUrl;
                conversation.postActivityToBot(activity, true, (err, statusCode) => {
                    if (err) {
                        res.send(HttpStatus.INTERNAL_SERVER_ERROR);
                        log.error("Failed to post activity to bot: " + err);
                    } else {
                        res.send(statusCode);
                    }
                    res.end();
                });
            } else {
                res.send(HttpStatus.NOT_FOUND, "conversation not found");
                log.error("DirectLine: Cannot post activity. Conversation not found");
                res.end();
            }
        } else {
            res.send(HttpStatus.NOT_FOUND, "no active bot");
            log.error("DirectLine: Cannot post activity. No active bot");
            res.end();
        }
    }

    static upload(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        res.send(HttpStatus.NOT_IMPLEMENTED);
        log.error("DirectLine: Cannot receive upload. Not implemented.");
        res.end();
    }

    static stream(req: Restify.Request, res: Restify.Response, next: Restify.Next): any {
        res.send(HttpStatus.NOT_IMPLEMENTED);
        log.error("DirectLine: Cannot upgrade socket. Not implemented.");
        res.end();
    }
}