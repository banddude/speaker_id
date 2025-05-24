# Speaker ID Server API Endpoints

This document lists all the API endpoints that the frontend interacts with in the Speaker ID Server backend.

## Main Application Routes

### 1. Root & Static Files
- **GET** `/` - Returns the main HTML dashboard page
- **GET** `/favicon.ico` - Returns the favicon

## Conversations API

### 2. List Conversations
- **GET** `/api/conversations`
- Returns all conversations with metadata (duration, speaker count, utterance count, speaker names)
- Used by: Dashboard, conversation list views

### 3. Get Specific Conversation
- **GET** `/api/conversations/{conversation_id}`
- Returns detailed conversation data including all utterances
- Used by: Conversation detail view, modal windows

### 4. Upload New Conversation
- **POST** `/api/conversations/upload`
- Uploads and processes audio files
- Body: `multipart/form-data` with file, display_name, thresholds
- Used by: Upload view

### 5. Update Conversation
- **PUT** `/api/conversations/{conversation_id}`
- Updates conversation display name
- Body: `form-data` with display_name
- Used by: Conversation editing

### 6. Delete Conversation
- **DELETE** `/api/conversations/{conversation_id}`
- Deletes conversation and all related data
- Used by: Conversation management

## Audio API

### 7. Get Utterance Audio
- **GET** `/api/audio/{conversation_id}/{utterance_id}`
- Returns presigned S3 URL for utterance audio file
- Used by: Audio players in conversation details

## Speakers API

### 8. List Speakers
- **GET** `/api/speakers`
- Returns all speakers with utterance counts and duration
- Used by: Speaker management view, dropdowns

### 9. Add Speaker
- **POST** `/api/speakers`
- Creates a new speaker
- Body: `form-data` with name
- Used by: Speaker creation forms

### 10. Update Speaker
- **PUT** `/api/speakers/{speaker_id}`
- Updates speaker name
- Body: `form-data` with name
- Used by: Speaker editing

### 11. Delete Speaker
- **DELETE** `/api/speakers/{speaker_id}`
- Deletes speaker and reassigns utterances
- Used by: Speaker management

### 12. Get Speaker Details
- **GET** `/api/speakers/{speaker_id}/details`
- Returns detailed speaker info with usage statistics
- Body: JSON with speaker info, utterance count, duration stats, recent utterances
- Used by: Speaker detail views

### 13. Bulk Update Speaker Utterances
- **PUT** `/api/speakers/{from_speaker_id}/update-all-utterances`
- Reassigns all utterances from one speaker to another
- Body: `form-data` with to_speaker_id
- Used by: Speaker merging functionality

## Utterances API

### 14. Update Utterance
- **PUT** `/api/utterances/{utterance_id}`
- Updates utterance speaker assignment or text
- Body: JSON with speaker_id or text
- Used by: Individual utterance editing

## Pinecone Vector Database API

### 15. List Pinecone Speakers
- **GET** `/api/pinecone/speakers`
- Returns all speakers and their embeddings from Pinecone
- Used by: Pinecone manager view

### 16. Add Pinecone Speaker
- **POST** `/api/pinecone/speakers`
- Creates new speaker with voice embedding
- Body: `multipart/form-data` with speaker_name and audio_file
- Used by: Pinecone speaker creation

### 17. Add Voice Embedding
- **POST** `/api/pinecone/embeddings`
- Adds additional voice sample to existing speaker
- Body: `multipart/form-data` with speaker_name and audio_file
- Used by: Adding more voice samples

### 18. Delete Pinecone Speaker
- **DELETE** `/api/pinecone/speakers/{speaker_name}`
- Removes speaker and all embeddings from Pinecone
- Used by: Pinecone speaker management

### 19. Delete Specific Embedding
- **DELETE** `/api/pinecone/embeddings/{embedding_id}`
- Removes specific voice embedding from Pinecone
- Used by: Fine-grained embedding management

## Frontend Endpoint Usage Summary

### Used by app.js (Main application):
- `/api/conversations` (GET)
- `/api/speakers` (GET, POST, PUT, DELETE)
- `/api/conversations/{id}` (GET)
- `/api/conversations/upload` (POST)
- `/api/pinecone/speakers` (GET, POST, DELETE)
- `/api/pinecone/embeddings` (POST, DELETE)
- `/api/utterances/{id}` (PUT)
- `/api/speakers/{id}/update-all-utterances` (PUT)

### Used by dashboard.js (Dashboard view):
- `/api/conversations` (GET)
- `/api/conversations/{id}` (GET, PUT, DELETE)
- `/api/speakers` (GET, POST, PUT, DELETE)
- `/api/utterances/{id}` (PUT)
- `/api/speakers/{id}/update-all-utterances` (PUT)
- `/api/conversations/upload` (POST)

### Used by speakers.js (Speaker management):
- `/api/speakers` (GET, POST)
- `/api/speakers/{id}` (PUT, DELETE)
- `/api/speakers/{id}/details` (GET)

### Used by pinecone.js (Pinecone manager):
- `/api/pinecone/speakers` (GET, POST, DELETE)
- `/api/pinecone/embeddings` (POST, DELETE)

### Used by fix_s3_deletion.js (Utility script):
- `/api/conversations/{id}` (DELETE)

## Notes

1. **Authentication**: No authentication endpoints are currently implemented
2. **WebSockets**: Mentioned in README but not implemented for real-time updates
3. **Error Handling**: All endpoints return 500 errors for server issues, 404 for not found

## Data Formats

- **Conversations**: Include id, conversation_id, created_at, duration, display_name, speaker_count, utterance_count, speakers
- **Speakers**: Include id, name, utterance_count, total_duration
- **Utterances**: Include id, speaker_id, speaker_name, start_time, end_time, text, audio_url
- **Pinecone Data**: Include speaker names, embedding IDs, and vector metadata 