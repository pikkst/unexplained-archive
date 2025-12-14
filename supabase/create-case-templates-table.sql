-- Create case templates table for guided case submission
CREATE TABLE IF NOT EXISTS case_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  form_fields JSONB NOT NULL,
  guidance_text TEXT,
  required_fields TEXT[],
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_templates_category ON case_templates(category);
CREATE INDEX IF NOT EXISTS idx_case_templates_public ON case_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_case_templates_usage ON case_templates(usage_count DESC);

-- Enable Row Level Security
ALTER TABLE case_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view public templates
CREATE POLICY "Anyone can view public templates"
  ON case_templates FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

-- Authenticated users can create templates
CREATE POLICY "Authenticated users can create templates"
  ON case_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON case_templates FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON case_templates FOR DELETE
  USING (auth.uid() = created_by);

-- Insert default templates
INSERT INTO case_templates (name, category, description, form_fields, guidance_text, required_fields, is_public) VALUES
(
  'UFO Sighting Report',
  'UFO',
  'Standardized template for reporting UFO sightings with essential details',
  '{
    "sighting_date": "Date and time of sighting",
    "duration": "How long did you observe it?",
    "shape": "Object shape (disk, triangle, cigar, sphere, etc.)",
    "size_estimate": "Approximate size compared to known objects",
    "color": "Color(s) observed",
    "movement_pattern": "How did it move?",
    "sound": "Did it make any sound?",
    "weather_conditions": "Weather at time of sighting",
    "witnesses": "Number of other witnesses",
    "photo_video": "Did you capture any photos or videos?"
  }',
  'Please provide as much detail as possible. Even small details can be important for investigation.',
  ARRAY['sighting_date', 'location', 'duration', 'description']
),
(
  'Cryptid Encounter',
  'Cryptid',
  'Template for documenting encounters with unknown creatures',
  '{
    "encounter_date": "When did the encounter occur?",
    "creature_description": "Detailed physical description",
    "height_estimate": "Estimated height/size",
    "behavior": "What was the creature doing?",
    "sounds": "Any vocalizations or sounds made?",
    "tracks_evidence": "Did you find tracks, hair, or other physical evidence?",
    "distance": "How far away were you?",
    "duration": "How long did the encounter last?",
    "fled_approached": "Did it flee or approach you?",
    "previous_sightings": "Are there other reports in this area?"
  }',
  'Document everything you remember. Physical evidence like tracks or hair samples are especially valuable.',
  ARRAY['encounter_date', 'location', 'creature_description']
),
(
  'Paranormal Activity Report',
  'Paranormal',
  'Template for reporting paranormal experiences and phenomena',
  '{
    "activity_type": "Type of activity (apparition, poltergeist, EVP, etc.)",
    "first_occurrence": "When did this first start?",
    "frequency": "How often does it happen?",
    "time_of_day": "Specific times when activity occurs?",
    "location_history": "History of the location",
    "witnesses": "Who else has experienced this?",
    "trigger_events": "Any patterns or triggers you noticed?",
    "physical_effects": "Any physical effects on people or objects?",
    "feeling_atmosphere": "Emotional or atmospheric changes?",
    "previous_investigation": "Has this been investigated before?"
  }',
  'Paranormal phenomena often follow patterns. Note any recurring elements or triggers.',
  ARRAY['activity_type', 'first_occurrence', 'location']
),
(
  'Supernatural Event Documentation',
  'Supernatural',
  'Template for documenting unexplained supernatural events',
  '{
    "event_date": "When did this occur?",
    "event_type": "What happened?",
    "before_event": "What was happening before the event?",
    "during_event": "Detailed description of the event",
    "after_event": "What happened after?",
    "affected_persons": "Who was affected?",
    "physical_changes": "Any physical changes to environment?",
    "emotional_state": "Emotional/mental state of witnesses",
    "documentation": "Photos, videos, or other documentation?",
    "similar_events": "Any similar events in the past?"
  }',
  'Supernatural events can be complex. Try to document the sequence of events as accurately as possible.',
  ARRAY['event_date', 'event_type', 'location']
),
(
  'Mystery Location Investigation',
  'Mystery Location',
  'Template for investigating mysterious or unexplained locations',
  '{
    "location_type": "Type of location (building, forest, cave, etc.)",
    "discovery_date": "When was this discovered?",
    "unusual_features": "What makes this location unusual?",
    "local_legends": "Any local stories or legends?",
    "physical_anomalies": "Unusual physical characteristics",
    "electromagnetic_readings": "Any unusual readings?",
    "access_difficulty": "How difficult is it to access?",
    "safety_concerns": "Any known dangers?",
    "previous_visitors": "What have others reported?",
    "coordinates": "GPS coordinates if available"
  }',
  'Mystery locations require thorough documentation. Include maps, coordinates, and detailed descriptions.',
  ARRAY['location_type', 'discovery_date', 'location']
);

-- Create function to increment usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE case_templates 
  SET usage_count = usage_count + 1 
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Would need to add template_id column to cases table and create trigger
-- This is a reference for future implementation
COMMENT ON TABLE case_templates IS 'Pre-built templates to help users submit complete and well-structured case reports';
