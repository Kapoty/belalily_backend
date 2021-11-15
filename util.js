function isValidCpf(cpf) {
	if (cpf == null)
		return false;
	cpf = cpf.replace(/[^\d]+/g,'');    
	if(cpf == '') return false; 
	// Elimina CPFs invalidos conhecidos    
	if (cpf.length != 11 || 
		cpf == "00000000000" || 
		cpf == "11111111111" || 
		cpf == "22222222222" || 
		cpf == "33333333333" || 
		cpf == "44444444444" || 
		cpf == "55555555555" || 
		cpf == "66666666666" || 
		cpf == "77777777777" || 
		cpf == "88888888888" || 
		cpf == "99999999999")
			return false;       
	// Valida 1o digito 
	add = 0;    
	for (i=0; i < 9; i ++)      
		add += parseInt(cpf.charAt(i)) * (10 - i);  
		rev = 11 - (add % 11);  
		if (rev == 10 || rev == 11)     
			rev = 0;    
		if (rev != parseInt(cpf.charAt(9)))     
			return false;       
	// Valida 2o digito 
	add = 0;    
	for (i = 0; i < 10; i ++)       
		add += parseInt(cpf.charAt(i)) * (11 - i);  
	rev = 11 - (add % 11);  
	if (rev == 10 || rev == 11) 
		rev = 0;    
	if (rev != parseInt(cpf.charAt(10)))
		return false;       
	return true;   
}

function isValidBirthday(day, month, year) {
	if (day == null || month == null || year == null)
		return false;
	year = parseInt(year);
	month = parseInt(month);
	day = parseInt(day);
	if (isNaN(year) || isNaN(month) || isNaN(day))
		return false;
	let birthday_date = new Date(year, month, day);
	let today_date = new Date();
	let age = Math.floor((today_date - birthday_date.getTime()) / 3.15576e+10);
	if (age < 3 || age > 150)
		return false;
	return true;
}

function isValidPhoneNumber(phoneNumber) {
	if (phoneNumber == null || phoneNumber == '' || !/^(\d)+$/.test(phoneNumber))
		return false;
	phoneNumber = phoneNumber.replace(/[^\d]+/g,'');
	if (phoneNumber.length != 11)
		return false;
	return true;
}

function isValidCep(cep) {
	if (cep == null || cep == '' || !/^(\d)+$/.test(cep))
		return false;
	cep = cep.replace(/[^\d]+/g,'');
	if (cep.length != 8)
		return false;
	return true;
}

function isValidEmail(email) {
	if (email == null || email == '')
		return false;
	let re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function isValidPassword(password) {
	if (password == null || password == '')
		return false;
	let re = /^[A-Za-z0-9_@]+$/;
    return re.test(String(password));
}

function isValidSecretAnswer(answer) {
	if (answer == null || answer == '')
		return false;
	let re = /^[A-Za-z0-9_@ ]+$/;
    return re.test(String(answer));
}

function isValidUsername(username) {
	if (username == null || username == '')
		return false;
	let re = /^[a-z][a-z0-9_]*$/;
	return re.test(String(username));
}

function isValidProfileName(name) {
	if (name == null || name == '')
		return false;
	let re = /^[A-Za-z0-9_\ ]+$/;
	return re.test(String(name));
}

module.exports = {isValidCpf , isValidBirthday, isValidPhoneNumber, isValidCep, isValidEmail, isValidPassword, isValidSecretAnswer, isValidUsername, isValidProfileName};