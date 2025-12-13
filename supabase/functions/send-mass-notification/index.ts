import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { notificationId } = await req.json();

    if (!notificationId) {
      throw new Error('Notification ID is required');
    }

    // Get notification details
    const { data: notification, error: notificationError } = await supabaseClient
      .from('mass_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notificationError) throw notificationError;
    
    console.log('Notification details:', JSON.stringify(notification, null, 2));

    // Update status to sending
    await supabaseClient
      .from('mass_notifications')
      .update({ 
        status: 'sending',
        started_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    // Get recipients
    let recipients: any[] = [];
    
    if (notification.target_group_code) {
      console.log(`Getting members for group: ${notification.target_group_code}`);
      
      const { data: groupMembers, error: membersError } = await supabaseClient.rpc(
        'get_subscription_group_members',
        { p_group_code: notification.target_group_code }
      );

      if (membersError) {
        console.error('Error getting group members:', membersError);
        throw new Error(`Failed to get group members: ${membersError.message}`);
      }

      if (groupMembers && groupMembers.length > 0) {
        recipients = groupMembers;
        console.log(`Found ${recipients.length} recipients in group ${notification.target_group_code}`);
      } else {
        console.log(`No members found in group ${notification.target_group_code}`);
      }
    } else if (notification.target_user_ids) {
      // Get users from profiles and join with auth.users for email
      const { data: users, error: usersError } = await supabaseClient
        .from('profiles')
        .select('id, username, full_name')
        .in('id', notification.target_user_ids);

      if (usersError) {
        console.error('Error getting target users:', usersError);
        throw new Error(`Failed to get target users: ${usersError.message}`);
      }

      if (users) {
        // Get emails from auth.users for each user
        const usersWithEmails = await Promise.all(
          users.map(async (user) => {
            const { data: authUser } = await supabaseClient.auth.admin.getUserById(user.id);
            return {
              user_id: user.id,
              email: authUser?.user?.email || user.username,
              full_name: user.full_name,
            };
          })
        );
        
        recipients = usersWithEmails;
        console.log(`Found ${recipients.length} specific users`);
      }
    }

    if (recipients.length === 0) {
      console.warn('No recipients found for this notification');
      await supabaseClient
        .from('mass_notifications')
        .update({
          status: 'completed',
          sent_count: 0,
          failed_count: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No recipients found',
          sentCount: 0,
          failedCount: 0,
          totalRecipients: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    console.log(`Delivery method: ${notification.delivery_method}`);
    console.log(`Notification type: ${notification.notification_type}`);
    console.log(`Processing ${recipients.length} recipients`);

    // Send notifications
    for (const recipient of recipients) {
      try {
        console.log(`Processing recipient: ${recipient.email} (user_id: ${recipient.user_id})`);
        
        // Send email if method is 'email' or 'both'
        if (notification.delivery_method === 'email' || notification.delivery_method === 'both') {
          // TODO: Integrate with actual email service (SendGrid, Resend, etc.)
          console.log(`Would send email to ${recipient.email}: ${notification.subject}`);
          
          // For now, just log - implement actual email sending later
          // Example: await sendEmail(recipient.email, notification.subject, notification.message);
        }

        // Create in-app notification if method is 'in_app' or 'both'
        if (notification.delivery_method === 'in_app' || notification.delivery_method === 'both') {
          console.log(`Inserting in-app notification for user ${recipient.user_id}`);
          
          const notificationData = {
            user_id: recipient.user_id,
            type: notification.notification_type || 'new_message',
            title: notification.subject,
            message: notification.message,
            data: {
              mass_notification_id: notificationId,
            },
          };
          
          console.log('Notification data:', JSON.stringify(notificationData));
          
          const { error: notifError } = await supabaseClient
            .from('notifications')
            .insert(notificationData);

          if (notifError) {
            console.error(`❌ Failed to create in-app notification for ${recipient.email}:`, JSON.stringify(notifError));
            errors.push({
              recipient: recipient.email,
              user_id: recipient.user_id,
              error: notifError,
              notificationData: notificationData
            });
            failedCount++;
          } else {
            console.log(`✓ Notification sent to ${recipient.email}`);
            sentCount++;
          }
        } else {
          // If email-only, count as sent (implement actual email service later)
          sentCount++;
        }
      } catch (error) {
        console.error(`Failed to send notification to ${recipient.email}:`, error);
        errors.push({
          recipient: recipient.email,
          error: error.message
        });
        failedCount++;
      }
    }

    // Update notification status
    await supabaseClient
      .from('mass_notifications')
      .update({
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
        errors: errors.length > 0 ? errors : undefined,
        debug: {
          deliveryMethod: notification.delivery_method,
          notificationType: notification.notification_type,
          recipientsFound: recipients.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Send mass notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
