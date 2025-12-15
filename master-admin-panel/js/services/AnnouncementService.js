/**
 * Announcement Service
 * שירות לניהול הודעות מערכת ב-Firestore
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

(function() {
    'use strict';

    class AnnouncementService {
        constructor(db) {
            if (!db) {
                throw new Error('Firestore database instance is required');
            }
            this.db = db;
            this.collection = 'system_announcements';
        }

        /**
         * Create new announcement
         * @param {SystemAnnouncement} announcement
         * @returns {Promise<string>} document ID
         */
        async create(announcement) {
            try {
                console.log('📝 Creating announcement:', announcement.title);

                const validation = announcement.validate();
                if (!validation.valid) {
                    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                }

                const docRef = await this.db.collection(this.collection).add(announcement.toFirestore());

                console.log('✅ Announcement created with ID:', docRef.id);
                return docRef.id;

            } catch (error) {
                console.error('❌ Error creating announcement:', error);
                throw error;
            }
        }

        /**
         * Read announcement by ID
         * @param {string} id
         * @returns {Promise<SystemAnnouncement|null>}
         */
        async read(id) {
            try {
                const doc = await this.db.collection(this.collection).doc(id).get();

                if (!doc.exists) {
                    console.warn('⚠️ Announcement not found:', id);
                    return null;
                }

                return window.SystemAnnouncement.fromFirestore(doc);

            } catch (error) {
                console.error('❌ Error reading announcement:', error);
                throw error;
            }
        }

        /**
         * Update announcement
         * @param {string} id
         * @param {Object} updates
         * @returns {Promise<void>}
         */
        async update(id, updates) {
            try {
                console.log('📝 Updating announcement:', id);

                // Add updatedAt timestamp
                updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                await this.db.collection(this.collection).doc(id).update(updates);

                console.log('✅ Announcement updated');

            } catch (error) {
                console.error('❌ Error updating announcement:', error);
                throw error;
            }
        }

        /**
         * Delete announcement
         * @param {string} id
         * @returns {Promise<void>}
         */
        async delete(id) {
            try {
                console.log('🗑️ Deleting announcement:', id);

                await this.db.collection(this.collection).doc(id).delete();

                console.log('✅ Announcement deleted');

            } catch (error) {
                console.error('❌ Error deleting announcement:', error);
                throw error;
            }
        }

        /**
         * List all announcements with optional filters
         * @param {Object} filters - { active, type, targetAudience }
         * @returns {Promise<SystemAnnouncement[]>}
         */
        async list(filters = {}) {
            try {
                console.log('📋 Listing announcements with filters:', filters);

                let query = this.db.collection(this.collection);

                // Apply filters
                if (filters.active !== undefined) {
                    query = query.where('active', '==', filters.active);
                }

                if (filters.type) {
                    query = query.where('type', '==', filters.type);
                }

                if (filters.targetAudience) {
                    query = query.where('targetAudience', '==', filters.targetAudience);
                }

                // Order by priority (desc) and createdAt (desc)
                query = query.orderBy('priority', 'desc').orderBy('createdAt', 'desc');

                const snapshot = await query.get();

                const announcements = snapshot.docs.map(doc =>
                    window.SystemAnnouncement.fromFirestore(doc)
                );

                console.log(`✅ Found ${announcements.length} announcements`);
                return announcements;

            } catch (error) {
                console.error('❌ Error listing announcements:', error);
                throw error;
            }
        }

        /**
         * Get active announcements for display
         * @param {string} targetAudience - 'all', 'employees', 'admins'
         * @returns {Promise<SystemAnnouncement[]>}
         */
        async getActiveAnnouncements(targetAudience = 'all') {
            try {
                const now = firebase.firestore.Timestamp.now();

                let query = this.db.collection(this.collection)
                    .where('active', '==', true)
                    .where('startDate', '<=', now);

                // Filter by target audience
                if (targetAudience !== 'all') {
                    query = query.where('targetAudience', 'in', ['all', targetAudience]);
                } else {
                    query = query.where('targetAudience', '==', 'all');
                }

                query = query.orderBy('startDate', 'desc')
                    .orderBy('priority', 'desc');

                const snapshot = await query.get();

                // Filter out expired announcements
                const announcements = snapshot.docs
                    .map(doc => window.SystemAnnouncement.fromFirestore(doc))
                    .filter(announcement => announcement.isCurrentlyActive());

                console.log(`✅ Found ${announcements.length} active announcements`);
                return announcements;

            } catch (error) {
                console.error('❌ Error getting active announcements:', error);
                throw error;
            }
        }

        /**
         * Listen to active announcements in real-time
         * @param {string} targetAudience
         * @param {Function} callback
         * @returns {Function} unsubscribe function
         */
        listenToActive(targetAudience = 'all', callback) {
            try {
                console.log('👂 Setting up real-time listener for active announcements');

                const now = firebase.firestore.Timestamp.now();

                let query = this.db.collection(this.collection)
                    .where('active', '==', true)
                    .where('startDate', '<=', now);

                if (targetAudience !== 'all') {
                    query = query.where('targetAudience', 'in', ['all', targetAudience]);
                } else {
                    query = query.where('targetAudience', '==', 'all');
                }

                query = query.orderBy('startDate', 'desc')
                    .orderBy('priority', 'desc');

                const unsubscribe = query.onSnapshot(
                    snapshot => {
                        const announcements = snapshot.docs
                            .map(doc => window.SystemAnnouncement.fromFirestore(doc))
                            .filter(announcement => announcement.isCurrentlyActive());

                        console.log(`🔄 Active announcements updated: ${announcements.length}`);
                        callback(announcements);
                    },
                    error => {
                        console.error('❌ Error in real-time listener:', error);
                    }
                );

                return unsubscribe;

            } catch (error) {
                console.error('❌ Error setting up listener:', error);
                throw error;
            }
        }

        /**
         * Toggle active status
         * @param {string} id
         * @param {boolean} active
         * @returns {Promise<void>}
         */
        async toggleActive(id, active) {
            try {
                console.log(`🔄 Toggling announcement ${id} to ${active ? 'active' : 'inactive'}`);

                await this.update(id, { active });

                console.log('✅ Status toggled');

            } catch (error) {
                console.error('❌ Error toggling status:', error);
                throw error;
            }
        }

        /**
         * Get announcements count
         * @param {Object} filters
         * @returns {Promise<number>}
         */
        async count(filters = {}) {
            try {
                let query = this.db.collection(this.collection);

                if (filters.active !== undefined) {
                    query = query.where('active', '==', filters.active);
                }

                const snapshot = await query.get();
                return snapshot.size;

            } catch (error) {
                console.error('❌ Error counting announcements:', error);
                throw error;
            }
        }
    }

    // Export
    window.AnnouncementService = AnnouncementService;

    console.log('✅ AnnouncementService loaded');

})();
