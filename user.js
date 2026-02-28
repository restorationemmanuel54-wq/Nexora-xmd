import mangoose from"mangoose";

const userSchema = new mongoose.Schema({
    username: {type:String, required:true},
    phoneNumber: {type:String, required:true},
    ownerNumber:{type:String,default:""},
    sessionPath:{type:String, default:""},
    botStatus:{type:String, default:"inactive"},
});

export default mongoose.model("User", userSchema);